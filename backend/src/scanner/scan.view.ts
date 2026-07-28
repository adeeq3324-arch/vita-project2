import type { AiJob, Product, ScanResult } from '../database/schema';

/** Client-facing shapes for the three scanners. */

export interface ScanResultView {
  id: string;
  type: ScanResult['type'];
  /** Short-lived signed URL for the analysed photo. Null for barcode scans. */
  imageUrl: string | null;
  barcodeValue: string | null;
  foodName: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** How well this fits the user, 0–100. */
  healthScore: number;
  aiInsight: string;
  /** Visual freshness, 0–100. Only present on colour-quality scans. */
  freshnessScore: number | null;
  scannedAt: string;
}

export interface ProductAlternativeView {
  name: string;
  reason: string;
}

export interface ProductView {
  id: string;
  barcode: string;
  brand: string;
  name: string;
  ingredients: string[];
  /** Nutritional quality of the product itself, independent of any person. */
  rating: number;
  alternatives: ProductAlternativeView[];
}

/** A barcode scan: the shared product facts plus this user's verdict on it. */
export interface BarcodeScanView {
  product: ProductView;
  scan: ScanResultView;
}

/**
 * What a scan endpoint returns.
 *
 * A discriminated union because a scan has two legitimate outcomes and the
 * client must handle both: usually the answer itself, and — when the model is
 * slow or rate-limited — a job to poll instead. Making that explicit in the type
 * is what stops a client rendering an empty result as though it were a real one.
 */
export type ScanOutcomeView =
  | { status: 'ready'; scan: ScanResultView }
  | { status: 'processing'; jobId: string };

export type BarcodeOutcomeView =
  | { status: 'ready'; product: ProductView; scan: ScanResultView }
  | { status: 'processing'; jobId: string };

/** Poll target for a deferred scan. */
export interface ScanJobView {
  jobId: string;
  status: AiJob['status'];
  /** The scan this job produced, once it has produced one. */
  scanId: string | null;
  error: string | null;
}

const round1 = (value: string | number): number => Math.round(Number(value) * 10) / 10;

/**
 * Renders a stored scan.
 *
 * `imageUrl` is passed in rather than read off the row: the column holds a
 * storage path, and a usable URL has to be signed at read time.
 */
export function toScanResultView(row: ScanResult, signedImageUrl: string | null): ScanResultView {
  return {
    id: row.id,
    type: row.type,
    imageUrl: signedImageUrl,
    barcodeValue: row.barcodeValue,
    foodName: row.foodName,
    kcal: Math.round(Number(row.calories)),
    protein: round1(row.proteinG),
    carbs: round1(row.carbsG),
    fat: round1(row.fatG),
    healthScore: row.healthScore,
    aiInsight: row.aiInsight,
    freshnessScore: row.freshnessScore,
    scannedAt: row.createdAt.toISOString(),
  };
}

export function toProductView(row: Product): ProductView {
  return {
    id: row.id,
    barcode: row.barcode,
    brand: row.brand,
    name: row.name,
    ingredients: row.ingredients,
    rating: row.rating,
    alternatives: row.aiAlternatives,
  };
}

export function toScanJobView(job: AiJob): ScanJobView {
  return {
    jobId: job.id,
    status: job.status,
    scanId: job.resultRefId,
    error: job.errorMessage,
  };
}
