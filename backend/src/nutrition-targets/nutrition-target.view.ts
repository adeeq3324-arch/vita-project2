import type { NutritionTarget } from '../database/schema';

/**
 * Client-facing daily nutrition targets.
 *
 * `bmr` / `tdee` are included so the app can show *why* the numbers are what
 * they are ("your body burns ~2,180 kcal a day"), and `source` tells it whether
 * the user has overridden them.
 */
export interface NutritionTargetView {
  userId: string;
  source: NutritionTarget['source'];
  /** Daily energy target, kcal. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Daily fluid target, millilitres. */
  waterMl: number;
  mealsPerDay: number;
  /** Basal metabolic rate, kcal/day. */
  bmr: number;
  /** Total daily energy expenditure, kcal/day. */
  tdee: number;
  /** When these targets were last derived. */
  computedAt: string;
}

export function toNutritionTargetView(target: NutritionTarget): NutritionTargetView {
  return {
    userId: target.userId,
    source: target.source,
    calories: target.calories,
    protein: target.proteinG,
    carbs: target.carbsG,
    fat: target.fatG,
    fiber: target.fiberG,
    waterMl: target.waterMl,
    mealsPerDay: target.mealsPerDay,
    bmr: Math.round(Number(target.bmr)),
    tdee: Math.round(Number(target.tdee)),
    computedAt: target.computedAt.toISOString(),
  };
}
