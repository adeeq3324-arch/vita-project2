import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import * as z from 'zod';
import { AI_SERVICE } from '../ai/ai.constants';
import { AiGenerationError, AiService } from '../ai/ai.interface';
import { parseStructured } from '../ai/structured';
import { UserContextService } from '../ai-context/user-context.service';
import { AiJobsService } from '../ai-jobs/ai-jobs.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import {
  products,
  scanResults,
  type AiJobType,
  type NewScanResult,
  type Product,
  type ScanResult,
} from '../database/schema';
import {
  JOB_ANALYSE_BARCODE_SCAN,
  JOB_ANALYSE_FOOD_SCAN,
  JOB_ANALYSE_QUALITY_SCAN,
  QUEUE_SCAN,
  type ScanJobData,
} from '../queue/queue.constants';
import { StorageService } from '../storage/storage.service';
import {
  buildFoodScanPrompt,
  buildProductInsightPrompt,
  buildProductLookupPrompt,
  buildQualityScanPrompt,
  foodScanSchema,
  isUnknownProduct,
  productLookupSchema,
  qualityScanSchema,
  SCANNER_SYSTEM_PROMPT,
  type ProductLookup,
} from './scan.schema';
import {
  toProductView,
  toScanJobView,
  toScanResultView,
  type BarcodeOutcomeView,
  type ScanJobView,
  type ScanOutcomeView,
  type ScanResultView,
} from './scan.view';

/**
 * How long a scan may take before the request stops waiting and hands the work
 * to the queue.
 *
 * Chosen from the user's side rather than the model's: past roughly twenty
 * seconds a spinner reads as a hang, and a poll is a better experience than a
 * request that might still be alive. The abandoned attempt is cancelled rather
 * than left running, so deferring costs one wasted call at most.
 */
const INLINE_BUDGET_MS = 20_000;

/** An image analysis is a short document; it needs far less room than a plan. */
const SCAN_MAX_TOKENS = 1024;

/**
 * The personalised half of a barcode scan.
 *
 * Asked for as a structure rather than as prose because a `scan_results` row
 * needs a score as well as an explanation, and getting both from one call is
 * cheaper and faster than a second round-trip for a number.
 */
const barcodeInsightSchema = z.object({
  healthScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('How well this product fits this specific person, 0–100'),
  insight: z
    .string()
    .min(20)
    .max(600)
    .describe('Two or three sentences addressed to the user, explaining the score'),
});

/** Job name for each scanner, so the deferred path mirrors the inline one. */
const JOB_NAMES = {
  food: JOB_ANALYSE_FOOD_SCAN,
  colorQuality: JOB_ANALYSE_QUALITY_SCAN,
  barcode: JOB_ANALYSE_BARCODE_SCAN,
} as const;

/** Ledger type for each scanner. */
const JOB_TYPES: Record<ScanJobData['scanType'], AiJobType> = {
  food: 'foodScan',
  colorQuality: 'colorScan',
  barcode: 'barcodeScan',
};

/**
 * The three scanners: food photograph, colour-quality photograph, and barcode.
 *
 * Each one tries to answer inline, because a scan is something the user is
 * standing there waiting for, and falls back to the queue when the model is slow
 * or rate-limited. Both paths run exactly the same analysis — the difference is
 * only who waits for it — so a deferred result is never a lesser one.
 */
@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @InjectQueue(QUEUE_SCAN) private readonly queue: Queue<ScanJobData>,
    private readonly storage: StorageService,
    private readonly userContext: UserContextService,
    private readonly aiJobs: AiJobsService,
  ) {}

  // ── entry points ──────────────────────────────────────────────────────────

  /** Identifies a food from a photograph and scores it for this user. */
  async scanFood(userId: string, file: Express.Multer.File): Promise<ScanOutcomeView> {
    return this.photoScan(userId, file, 'food');
  }

  /** Judges freshness and quality from a photograph. */
  async scanQuality(userId: string, file: Express.Multer.File): Promise<ScanOutcomeView> {
    return this.photoScan(userId, file, 'colorQuality');
  }

  /**
   * Resolves a packaged product and gives this user a verdict on it.
   *
   * The product half is looked up once and shared; only the verdict is
   * generated per user, so the common case of a already-known barcode costs a
   * single short call rather than a full product lookup.
   */
  async scanBarcode(userId: string, barcode: string): Promise<BarcodeOutcomeView> {
    // Validated before anything is written, so an un-onboarded user gets a clear
    // 404 rather than a ledger entry that goes nowhere.
    await this.userContext.build(userId);

    const job = await this.aiJobs.enqueue(userId, 'barcodeScan');

    const outcome = await this.attempt(job.id, (signal) =>
      this.runBarcodeScan(userId, barcode, signal),
    );

    if (!outcome.deferred) {
      const scan = await this.requireScan(userId, outcome.resultId);
      const product = await this.requireProductForScan(scan);
      return { status: 'ready', product: toProductView(product), scan: await this.render(scan) };
    }

    await this.queue.add(JOB_NAMES.barcode, {
      aiJobId: job.id,
      userId,
      scanType: 'barcode',
      barcode,
    });

    return { status: 'processing', jobId: job.id };
  }

  /** Poll target for a deferred scan. */
  async getJob(userId: string, jobId: string): Promise<ScanJobView> {
    const job = await this.aiJobs.findOwned(userId, jobId);
    if (!job) {
      throw new NotFoundException('Scan job not found.');
    }
    return toScanJobView(job);
  }

  /** A stored scan result, with a freshly signed image URL. */
  async getScan(userId: string, scanId: string): Promise<ScanResultView> {
    return this.render(await this.requireScan(userId, scanId));
  }

  // ── worker entry points ───────────────────────────────────────────────────

  /**
   * Analyses a stored photograph. Returns the new scan's id so the job ledger
   * can record what the work produced.
   */
  async runPhotoScan(
    userId: string,
    scanType: 'food' | 'colorQuality',
    imagePath: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const context = await this.userContext.build(userId);

    // Signed only for as long as the analysis needs it, so the URL handed to the
    // model is useless by the time the call is over.
    const imageUrl = await this.storage.createSignedUrl(imagePath, 300);

    const isQuality = scanType === 'colorQuality';
    const raw = await this.ai.analyzeImage(
      imageUrl,
      isQuality ? buildQualityScanPrompt(context) : buildFoodScanPrompt(context),
      {
        system: SCANNER_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: SCAN_MAX_TOKENS,
        signal,
      },
    );

    // The quality analysis is the food analysis plus one field, so both branches
    // are validated against their own schema and the extra field is read off the
    // narrowed branch rather than from a widened union.
    const quality = isQuality ? parseStructured(raw, qualityScanSchema) : null;
    const analysis = quality ?? parseStructured(raw, foodScanSchema);

    const [saved] = await this.db
      .insert(scanResults)
      .values({
        userId,
        type: scanType,
        imageUrl: imagePath,
        foodName: analysis.foodName.trim(),
        calories: analysis.calories.toFixed(2),
        proteinG: analysis.protein.toFixed(2),
        carbsG: analysis.carbs.toFixed(2),
        fatG: analysis.fat.toFixed(2),
        healthScore: analysis.healthScore,
        aiInsight: analysis.aiInsight.trim(),
        freshnessScore: quality?.freshnessScore ?? null,
      } satisfies NewScanResult)
      .returning();

    return saved.id;
  }

  /** Resolves a barcode and records this user's scan of it. */
  async runBarcodeScan(userId: string, barcode: string, signal?: AbortSignal): Promise<string> {
    const context = await this.userContext.build(userId);
    const product = await this.resolveProduct(barcode, signal);

    const verdict = await this.ai.generateStructured(
      buildProductInsightPrompt(context, {
        brand: product.brand,
        name: product.name,
        ingredients: product.ingredients,
        rating: product.rating,
      }),
      barcodeInsightSchema,
      {
        system: SCANNER_SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: SCAN_MAX_TOKENS,
        signal,
      },
    );

    const [saved] = await this.db
      .insert(scanResults)
      .values({
        userId,
        type: 'barcode',
        barcodeValue: barcode,
        productId: product.id,
        foodName: `${product.brand} ${product.name}`.trim(),
        calories: product.calories,
        proteinG: product.proteinG,
        carbsG: product.carbsG,
        fatG: product.fatG,
        healthScore: verdict.healthScore,
        aiInsight: verdict.insight.trim(),
      } satisfies NewScanResult)
      .returning();

    return saved.id;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * Shared flow for the two photograph scanners: store the image, then analyse
   * it inline or hand it to the queue.
   *
   * The upload happens before the ledger entry so that a rejected file never
   * produces a job, and the image is deleted again if the analysis fails
   * outright — an orphaned photo of somebody's dinner is not something to keep.
   */
  private async photoScan(
    userId: string,
    file: Express.Multer.File,
    scanType: 'food' | 'colorQuality',
  ): Promise<ScanOutcomeView> {
    await this.userContext.build(userId);

    const imagePath = await this.storage.uploadScanImage(userId, file);
    const job = await this.aiJobs.enqueue(userId, JOB_TYPES[scanType]);

    let outcome: AttemptOutcome;
    try {
      outcome = await this.attempt(job.id, (signal) =>
        this.runPhotoScan(userId, scanType, imagePath, signal),
      );
    } catch (error) {
      await this.storage.remove(imagePath);
      throw error;
    }

    if (!outcome.deferred) {
      return { status: 'ready', scan: await this.getScan(userId, outcome.resultId) };
    }

    await this.queue.add(JOB_NAMES[scanType], {
      aiJobId: job.id,
      userId,
      scanType,
      imagePath,
    });

    return { status: 'processing', jobId: job.id };
  }

  /**
   * Runs the analysis inline under a deadline, reporting whether it finished.
   *
   * Three outcomes, and the distinction between the last two is the point:
   * success completes the ledger entry; a slow or rate-limited attempt leaves it
   * `queued` for a worker to pick up; a genuine fault — an unreadable image, a
   * refusal, an invalid response — marks it `failed` and propagates, because
   * retrying it on a queue would only fail again more slowly.
   */
  private async attempt(
    aiJobId: string,
    work: (signal: AbortSignal) => Promise<string>,
  ): Promise<AttemptOutcome> {
    await this.aiJobs.markProcessing(aiJobId, null);

    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), INLINE_BUDGET_MS);

    try {
      const resultId = await work(deadline.signal);
      await this.aiJobs.markReady(aiJobId, null, resultId);
      return { deferred: false, resultId };
    } catch (error) {
      if (deadline.signal.aborted || this.isTransient(error)) {
        this.logger.log(`Scan job ${aiJobId} exceeded its inline budget; deferring to the queue`);
        await this.aiJobs.requeue(aiJobId);
        return { deferred: true };
      }

      await this.aiJobs.markFailed(
        aiJobId,
        null,
        error instanceof Error ? error.message : 'The scan could not be completed.',
      );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private isTransient(error: unknown): boolean {
    return error instanceof AiGenerationError && error.retryable;
  }

  /**
   * The shared product record for a barcode, looking it up only when the cache
   * does not already have it.
   *
   * An unrecognised code is reported rather than stored: caching a fabricated
   * product would serve that invention to every future user who scans it.
   */
  private async resolveProduct(barcode: string, signal?: AbortSignal): Promise<Product> {
    const cached = await this.db.query.products.findFirst({
      where: eq(products.barcode, barcode),
    });
    if (cached) {
      return cached;
    }

    const lookup = await this.ai.generateStructured(
      buildProductLookupPrompt(barcode),
      productLookupSchema,
      {
        system: SCANNER_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: SCAN_MAX_TOKENS,
        signal,
      },
    );

    if (isUnknownProduct(lookup)) {
      throw new NotFoundException(
        'That barcode is not recognised. Try scanning the item as a photo instead.',
      );
    }

    return this.cacheProduct(barcode, lookup);
  }

  /**
   * Writes a resolved product to the shared cache.
   *
   * Upserted rather than inserted: two users can scan the same new barcode at
   * the same moment, and the loser of that race should get the winner's row back
   * instead of a unique-violation.
   */
  private async cacheProduct(barcode: string, lookup: ProductLookup): Promise<Product> {
    const values = {
      barcode,
      brand: lookup.brand.trim(),
      name: lookup.name.trim(),
      ingredients: lookup.ingredients.map((item) => item.trim()).filter(Boolean),
      rating: lookup.rating,
      aiAlternatives: lookup.alternatives,
      calories: lookup.calories.toFixed(2),
      proteinG: lookup.protein.toFixed(2),
      carbsG: lookup.carbs.toFixed(2),
      fatG: lookup.fat.toFixed(2),
    };

    const [saved] = await this.db
      .insert(products)
      .values(values)
      .onConflictDoUpdate({
        target: products.barcode,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();

    return saved;
  }

  /** A scan belonging to the caller, or a 404 — never another user's row. */
  private async requireScan(userId: string, scanId: string): Promise<ScanResult> {
    const scan = await this.db.query.scanResults.findFirst({
      where: and(eq(scanResults.id, scanId), eq(scanResults.userId, userId)),
    });

    if (!scan) {
      throw new NotFoundException('Scan not found.');
    }
    return scan;
  }

  private async requireProductForScan(scan: ScanResult): Promise<Product> {
    const product = scan.productId
      ? await this.db.query.products.findFirst({ where: eq(products.id, scan.productId) })
      : undefined;

    if (!product) {
      throw new NotFoundException('The scanned product could not be found.');
    }
    return product;
  }

  /** Renders a scan, signing its stored image path if it has one. */
  private async render(scan: ScanResult): Promise<ScanResultView> {
    const imageUrl = scan.imageUrl ? await this.storage.createSignedUrl(scan.imageUrl) : null;
    return toScanResultView(scan, imageUrl);
  }
}

/** Whether an inline attempt produced a result or handed the work onward. */
type AttemptOutcome = { deferred: false; resultId: string } | { deferred: true };
