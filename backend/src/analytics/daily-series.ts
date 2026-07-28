import type { Goal, Profile } from '../database/schema';
import type { MacroTotals } from '../meal-logs/meal-log.view';
import type { NutritionTargetView } from '../nutrition-targets/nutrition-target.view';
import type { WorkoutTotals } from '../workout-logs/workout-log.view';

/**
 * One calendar day of a user's history, with every tracked domain on the same
 * row — intake, hydration, movement, body weight, training and the composite
 * score.
 *
 * Days on which nothing was recorded are still present, zeroed. Every consumer
 * (charts, snapshot roll-ups, achievement streaks) needs an unbroken series, and
 * filling the gaps once here is what stops each of them inventing its own idea of
 * what a missing day means.
 */
export interface DailySeriesPoint {
  date: string;
  /** Nutrition consumed, aggregated from the food diary. */
  intake: MacroTotals;
  mealCount: number;

  waterMl: number;
  waterTargetMl: number;
  steps: number;
  stepsTarget: number;

  /** Morning weigh-in, kg; null on days the user did not weigh in. */
  weightKg: number | null;

  workouts: WorkoutTotals;

  /** Composite 0–100 score; null on days that cannot be scored. */
  healthScore: number | null;
}

/**
 * A window of daily history plus the per-user context needed to interpret it.
 *
 * Assembled once per analytics request and passed by reference to everything that
 * reads it, so a screen aggregating a month costs one set of queries rather than
 * one per section.
 */
export interface AnalyticsWindow {
  from: string;
  to: string;
  timeZone: string;
  /** Today in the user's time zone — the anchor every relative label uses. */
  today: string;

  profile: Profile | undefined;
  goal: Goal | undefined;
  /** Null when the user has not completed onboarding; targets cannot exist yet. */
  targets: NutritionTargetView | null;

  /** Ascending, gap-filled, one entry per calendar day in `[from, to]`. */
  days: DailySeriesPoint[];
  /** Real weigh-ins inside the window, ascending. Excludes days without one. */
  weighIns: { date: string; weightKg: number }[];
}

/** True when the day has anything recorded at all — a meal, water, steps, training. */
export function isLoggedDay(day: DailySeriesPoint): boolean {
  return (
    day.mealCount > 0 ||
    day.waterMl > 0 ||
    day.steps > 0 ||
    day.workouts.sessions > 0 ||
    day.weightKg !== null
  );
}

/** Sums a numeric field across the window. */
export function sumOver(days: readonly DailySeriesPoint[], pick: (day: DailySeriesPoint) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

/**
 * Mean of a field over `days`, or 0 for an empty window.
 *
 * Deliberately averaged over *every* day rather than only the logged ones: an
 * "average daily intake" that silently skipped the days a user ate without
 * logging would flatter them, and the figure is presented as a daily average.
 */
export function averageOver(
  days: readonly DailySeriesPoint[],
  pick: (day: DailySeriesPoint) => number,
): number {
  return days.length === 0 ? 0 : sumOver(days, pick) / days.length;
}

/**
 * Mean of a nullable field across the days that have a value, or null when none
 * do. Used for the health score, where a day that could not be scored is absent
 * evidence rather than a zero.
 */
export function averageDefined(
  days: readonly DailySeriesPoint[],
  pick: (day: DailySeriesPoint) => number | null,
): number | null {
  const values = days.map(pick).filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * The longest run of consecutive days ending at the last day of `days` for which
 * `holds` is true.
 *
 * The final day is allowed to fail without breaking the run: an unfinished today
 * has not yet had the chance to satisfy anything, and reporting a streak as lost
 * at 9am would be both wrong and demoralising.
 */
export function trailingStreak(
  days: readonly DailySeriesPoint[],
  holds: (day: DailySeriesPoint) => boolean,
): number {
  if (days.length === 0) {
    return 0;
  }

  let index = days.length - 1;
  if (!holds(days[index])) {
    index -= 1;
  }

  let streak = 0;
  for (; index >= 0 && holds(days[index]); index -= 1) {
    streak += 1;
  }
  return streak;
}
