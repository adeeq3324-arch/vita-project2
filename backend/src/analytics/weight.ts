import type { AnalyticsWindow } from './daily-series';

/**
 * A user's weight movement over a window, measured against their goal.
 *
 * Shared rather than reimplemented per feature because the sign conventions are
 * subtle and every surface has to agree on them: a Progress chart, a milestone bar
 * and an achievement all have to call the same 1.2 kg either progress or backsliding.
 */
export interface WeightJourney {
  /** Baseline weight, kg — see the note in {@link buildWeightJourney}. */
  start: number | null;
  /** Most recent known weight, kg. */
  current: number | null;
  /** Goal weight, kg; null when the user has not set one. */
  target: number | null;

  /** `current - start`. Negative means weight was lost. Null without both ends. */
  deltaKg: number | null;
  /** Kilograms covered *toward* the target, clamped to `[0, distanceKg]`. */
  progressKg: number;
  /** Kilograms between the baseline and the target; 0 when there is no target. */
  distanceKg: number;
  /** Completion toward the target, 0–100; null when there is nothing to measure. */
  percent: number | null;
  /**
   * Whether the movement is the *desired* direction. With no target set, losing
   * weight is the conventional reading of progress, and holding steady counts as
   * holding ground.
   */
  movingTowardTarget: boolean;
}

/**
 * Builds the weight journey for a window.
 *
 * The baseline is the earliest real weigh-in inside the window, falling back to
 * the weight captured at onboarding. Two consequences are deliberate:
 *
 *  - A user who has never stepped on the scales still gets a sensible starting
 *    point rather than an empty chart.
 *  - The baseline is *relative to the window*, so "this week" measures movement
 *    within the week rather than since the account was created. Long-range
 *    comparisons are what `progress_snapshots` is for.
 */
export function buildWeightJourney(window: AnalyticsWindow): WeightJourney {
  const profileWeight = window.profile ? Number(window.profile.weightKg) : null;
  const start = window.weighIns[0]?.weightKg ?? profileWeight;
  const current = window.weighIns.at(-1)?.weightKg ?? profileWeight;
  const target = window.goal?.targetWeightKg == null ? null : Number(window.goal.targetWeightKg);

  const deltaKg =
    start !== null && current !== null ? Math.round((current - start) * 10) / 10 : null;

  if (start === null || current === null || target === null) {
    return {
      start,
      current,
      target,
      deltaKg,
      progressKg: 0,
      distanceKg: 0,
      percent: null,
      // Without a target, "down" is progress and "unchanged" is not a setback.
      movingTowardTarget: deltaKg !== null && deltaKg <= 0,
    };
  }

  const distance = Math.abs(target - start);

  // Already at the target when it was set: there is no distance to cover, so the
  // journey is complete by definition rather than stuck at zero forever.
  if (distance < 0.05) {
    return {
      start,
      current,
      target,
      deltaKg,
      progressKg: 0,
      distanceKg: 0,
      percent: 100,
      movingTowardTarget: true,
    };
  }

  const direction = Math.sign(target - start);
  const moved = (current - start) * direction;
  const progressKg = Math.round(Math.min(distance, Math.max(0, moved)) * 10) / 10;

  return {
    start,
    current,
    target,
    deltaKg,
    progressKg,
    distanceKg: Math.round(distance * 10) / 10,
    percent: Math.round((progressKg / distance) * 100),
    // Exactly on the baseline is holding ground, not moving the wrong way.
    movingTowardTarget: moved >= 0,
  };
}

/** Body mass index from height in centimetres and weight in kilograms. */
export function calculateBmi(heightCm: number, weightKg: number): number | null {
  if (heightCm <= 0 || weightKg <= 0) {
    return null;
  }
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/** The WHO band a BMI falls in, as the app labels it. */
export function bmiBand(bmi: number): string {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}
