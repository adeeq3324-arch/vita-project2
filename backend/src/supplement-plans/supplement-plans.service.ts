import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { AI_SERVICE } from '../ai/ai.constants';
import { AiService } from '../ai/ai.interface';
import { UserContextService } from '../ai-context/user-context.service';
import { AiJobsService } from '../ai-jobs/ai-jobs.service';
import { resolveTimeZone, startOfMonth, todayIn } from '../common/util/date.util';
import { DRIZZLE, type Database } from '../database/database.constants';
import {
  supplementPlanItems,
  supplementPlans,
  type NewSupplementPlanItem,
  type SupplementPlan,
} from '../database/schema';
import { ProfilesService } from '../profiles/profiles.service';
import {
  JOB_GENERATE_SUPPLEMENT_PLAN,
  QUEUE_SUPPLEMENT_PLAN,
  type GenerationJobData,
} from '../queue/queue.constants';
import {
  buildSupplementPrompt,
  supplementPlanGenerationSchema,
  SUPPLEMENT_SYSTEM_PROMPT,
  withDisclaimer,
  type GeneratedSupplementItem,
} from './supplement-plan.schema';
import {
  toSupplementItemView,
  toSupplementPlanStatusView,
  toSupplementPlanView,
  type SupplementItemView,
  type SupplementPlanStatusView,
  type SupplementPlanView,
} from './supplement-plan.view';

/**
 * A regimen is a short list; it needs far less room than a week of meals, but
 * each item now carries a facts panel, its benefits and its cautions.
 */
const SUPPLEMENT_MAX_TOKENS = 5120;

/**
 * How recently a user must have used the app to be swept into the monthly
 * regeneration. Generating for accounts nobody is opening spends money on
 * nothing, and a returning user gets a plan on demand the moment they ask.
 */
const ACTIVE_WITHIN_DAYS = 45;

/**
 * Monthly AI supplement plans.
 *
 * The unit is a calendar month, and there is exactly one plan per user per
 * month. That is enforced by a unique index rather than by checking first, so
 * "generate" is genuinely idempotent: an existing month's plan is returned
 * as-is, and no amount of repeated tapping produces a second one or spends a
 * second model call.
 */
@Injectable()
export class SupplementPlansService {
  private readonly logger = new Logger(SupplementPlansService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @InjectQueue(QUEUE_SUPPLEMENT_PLAN) private readonly queue: Queue<GenerationJobData>,
    private readonly profiles: ProfilesService,
    private readonly userContext: UserContextService,
    private readonly aiJobs: AiJobsService,
  ) {}

  /**
   * Returns this month's plan, generating one only if the month has none.
   *
   * Unlike the weekly meal plan, this never regenerates over an existing plan.
   * A regimen is meant to be followed for the month; replacing it midway because
   * a screen was reopened would undermine the one thing it asks of the user.
   */
  async generate(userId: string): Promise<SupplementPlanStatusView> {
    // Throws when onboarding is incomplete — before anything is written.
    await this.userContext.build(userId);

    const timeZone = await this.profiles.getTimeZone(userId);
    const monthStartDate = startOfMonth(todayIn(timeZone));

    return toSupplementPlanStatusView(await this.ensurePlan(userId, monthStartDate));
  }

  /** This month's plan. Creates nothing — a month with no plan is a 404. */
  async getCurrent(userId: string): Promise<SupplementPlanView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const monthStartDate = startOfMonth(todayIn(timeZone));

    const plan = await this.findForMonth(userId, monthStartDate);
    if (!plan) {
      throw new NotFoundException(
        'No supplement plan for this month yet. Generate one first.',
      );
    }

    return this.withItems(plan);
  }

  /** Poll target: the plan's lifecycle state and nothing else. */
  async getStatus(userId: string, planId: string): Promise<SupplementPlanStatusView> {
    return toSupplementPlanStatusView(await this.findOwned(userId, planId));
  }

  /** The full plan by id. Items are empty until generation completes. */
  async getById(userId: string, planId: string): Promise<SupplementPlanView> {
    return this.withItems(await this.findOwned(userId, planId));
  }

  /** One supplement from a plan, for the detail screen and deep links into it. */
  async getItem(
    userId: string,
    planId: string,
    itemId: string,
  ): Promise<SupplementItemView> {
    await this.findOwned(userId, planId);

    // Scoped to the plan the caller was just proven to own, so an item id from
    // someone else's regimen simply does not match.
    const item = await this.db.query.supplementPlanItems.findFirst({
      where: and(
        eq(supplementPlanItems.id, itemId),
        eq(supplementPlanItems.supplementPlanId, planId),
      ),
    });

    if (!item) {
      throw new NotFoundException('Supplement not found.');
    }
    return toSupplementItemView(item);
  }

  /**
   * The generation itself, called by the queue worker. Returns the plan id so
   * the job ledger can record what the work produced.
   */
  async runGeneration(userId: string, planId: string): Promise<string> {
    const plan = await this.findOwned(userId, planId);
    const context = await this.userContext.build(userId);

    const generated = await this.ai.generateStructured(
      buildSupplementPrompt(context, plan.monthStartDate),
      supplementPlanGenerationSchema,
      {
        system: SUPPLEMENT_SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: SUPPLEMENT_MAX_TOKENS,
      },
    );

    const rows = this.toRows(plan.id, generated.items);
    if (rows.length === 0) {
      throw new Error('The generated supplement plan contained no usable items.');
    }

    // Replace wholesale inside a transaction: a retried attempt must not stack a
    // second copy of the regimen on top of a partially-written first one.
    await this.db.transaction(async (tx) => {
      await tx
        .delete(supplementPlanItems)
        .where(eq(supplementPlanItems.supplementPlanId, plan.id));
      await tx.insert(supplementPlanItems).values(rows);
    });

    this.logger.log(`Generated ${rows.length} supplements for plan ${plan.id}`);
    return plan.id;
  }

  /**
   * Queues this month's plan for every active user. Driven by the monthly
   * scheduler; reuses the ordinary generation path, so a swept plan is
   * indistinguishable from one a user asked for.
   *
   * Failures are per-user and swallowed: one account without a profile must not
   * stop the sweep reaching the rest.
   */
  async sweepActiveUsers(): Promise<number> {
    const users = await this.findActiveUsers();
    this.logger.log(`Monthly supplement sweep: ${users.length} active users`);

    let queued = 0;
    for (const user of users) {
      try {
        // Each user's month boundary is resolved in their own time zone. The
        // sweep fires at a single instant, but that instant is not the 1st
        // everywhere — using the server's month would generate a month early
        // for users ahead of it and a month late for those behind.
        const monthStartDate = startOfMonth(todayIn(resolveTimeZone(user.timezone)));
        const plan = await this.ensurePlan(user.userId, monthStartDate);
        if (plan.status !== 'ready') {
          queued += 1;
        }
      } catch (error) {
        this.logger.warn(
          `Skipped ${user.userId} in the monthly sweep: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    this.logger.log(`Monthly supplement sweep queued ${queued} plans`);
    return queued;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * Returns the month's plan, creating and enqueueing one if it does not exist.
   *
   * `onConflictDoNothing` against the one-per-month unique index is what makes
   * this safe under concurrency: only the request that actually inserted the row
   * gets one back, so only it enqueues a job. Everyone else falls through to the
   * read and returns the plan already in progress.
   */
  private async ensurePlan(userId: string, monthStartDate: string): Promise<SupplementPlan> {
    const [created] = await this.db
      .insert(supplementPlans)
      .values({ userId, monthStartDate, status: 'idle' })
      .onConflictDoNothing({ target: [supplementPlans.userId, supplementPlans.monthStartDate] })
      .returning();

    if (created) {
      const job = await this.aiJobs.enqueue(userId, 'supplementPlan');
      await this.queue.add(JOB_GENERATE_SUPPLEMENT_PLAN, {
        aiJobId: job.id,
        userId,
        targetId: created.id,
      });
      return created;
    }

    const existing = await this.findForMonth(userId, monthStartDate);
    if (!existing) {
      throw new NotFoundException('The supplement plan could not be found.');
    }

    // A previous attempt failed and left nothing usable behind — retry it rather
    // than leaving the user stuck on an error until the month rolls over.
    if (existing.status === 'failed') {
      return this.retry(existing);
    }

    return existing;
  }

  /** Moves a failed plan back to `idle` and re-enqueues it, guarding races. */
  private async retry(plan: SupplementPlan): Promise<SupplementPlan> {
    const [reset] = await this.db
      .update(supplementPlans)
      .set({ status: 'idle', errorMessage: null, updatedAt: new Date() })
      .where(and(eq(supplementPlans.id, plan.id), ne(supplementPlans.status, 'generating')))
      .returning();

    // Another request beat us to it; its job is already in flight.
    if (!reset) {
      return plan;
    }

    const job = await this.aiJobs.enqueue(plan.userId, 'supplementPlan');
    await this.queue.add(JOB_GENERATE_SUPPLEMENT_PLAN, {
      aiJobId: job.id,
      userId: plan.userId,
      targetId: plan.id,
    });

    return reset;
  }

  private async withItems(plan: SupplementPlan): Promise<SupplementPlanView> {
    const items = await this.db.query.supplementPlanItems.findMany({
      where: eq(supplementPlanItems.supplementPlanId, plan.id),
      orderBy: [asc(supplementPlanItems.createdAt)],
    });

    return toSupplementPlanView(plan, items);
  }

  private async findForMonth(
    userId: string,
    monthStartDate: string,
  ): Promise<SupplementPlan | undefined> {
    return this.db.query.supplementPlans.findFirst({
      where: and(
        eq(supplementPlans.userId, userId),
        eq(supplementPlans.monthStartDate, monthStartDate),
      ),
    });
  }

  /** A plan belonging to the caller, or a 404 — never another user's row. */
  private async findOwned(userId: string, planId: string): Promise<SupplementPlan> {
    const plan = await this.db.query.supplementPlans.findFirst({
      where: and(eq(supplementPlans.id, planId), eq(supplementPlans.userId, userId)),
    });

    if (!plan) {
      throw new NotFoundException('Supplement plan not found.');
    }
    return plan;
  }

  /**
   * Users worth generating for: onboarding complete, and something logged
   * recently. Expressed as one query rather than a fetch-then-filter so the
   * sweep does not pull the whole user table into memory as it grows.
   */
  private async findActiveUsers(): Promise<{ userId: string; timezone: string }[]> {
    const rows = await this.db.execute<{ user_id: string; timezone: string }>(sql`
      SELECT p.user_id, p.timezone
      FROM profiles p
      JOIN goals g ON g.user_id = p.user_id
      WHERE EXISTS (
              SELECT 1 FROM meal_logs m
              WHERE m.user_id = p.user_id
                AND m.logged_at > now() - ${`${ACTIVE_WITHIN_DAYS} days`}::interval
            )
         OR EXISTS (
              SELECT 1 FROM daily_metrics d
              WHERE d.user_id = p.user_id
                AND d.updated_at > now() - ${`${ACTIVE_WITHIN_DAYS} days`}::interval
            )
    `);

    return rows.map((row) => ({ userId: row.user_id, timezone: row.timezone }));
  }

  /** Maps generated items onto rows, attaching the disclaimer to each. */
  private toRows(
    supplementPlanId: string,
    items: readonly GeneratedSupplementItem[],
  ): NewSupplementPlanItem[] {
    return items.map((item) => ({
      supplementPlanId,
      supplementName: item.supplementName.trim(),
      tier: item.tier,
      category: item.category.trim(),
      headline: item.headline.trim(),
      bestTime: item.bestTime,
      servingSize: item.servingSize.trim(),
      ingredients: item.ingredients.map((entry) => ({
        name: entry.name.trim(),
        amount: entry.amount.trim(),
      })),
      purpose: item.purpose.trim(),
      recommendation: withDisclaimer(item.recommendation),
      benefits: item.benefits.map((benefit) => benefit.trim()),
      safety: item.safety.map((caution) => caution.trim()),
    }));
  }
}
