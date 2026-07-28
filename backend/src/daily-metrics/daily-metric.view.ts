/**
 * Client-facing daily metrics for a single day.
 *
 * Each tracked value is paired with the target it is measured against, so the
 * client can render a progress bar without holding a second copy of the user's
 * goals or knowing how they were derived.
 */
export interface DailyMetricView {
  date: string;
  /** "Today" / "Yesterday" / weekday / "12 Mar". */
  dayLabel: string;

  steps: number;
  stepsTarget: number;

  /** Fluid intake for the day, millilitres. */
  waterMl: number;
  waterTargetMl: number;

  /** Energy burned through activity, kcal. */
  activeCalories: number;

  /** Morning body weight, kg; null on days without a weigh-in. */
  weightKg: number | null;

  workoutCompleted: boolean;
  workoutMinutes: number;

  /** Composite 0–100 adherence score; null until the day can be scored. */
  healthScore: number | null;
  /** Plain-language band for the score ("Excellent"); null alongside it. */
  healthScoreCaption: string | null;
}
