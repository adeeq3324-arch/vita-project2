import { api } from '@/services/api/client';

/**
 * Daily metrics service — the day's water, weight, steps and workout state.
 *
 * These are the inputs the food diary cannot supply. Together with meals they
 * make up the health score (calories 30%, protein 20%, water 15%, steps 15%,
 * workout 10%, logging 10%), so a day with no water or weigh-in can never score
 * above 75 however well it was eaten.
 */

export interface DailyMetrics {
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
  healthScoreCaption: string | null;
}

/** Fields a client may write. Only those supplied are changed. */
export interface UpdateMetricsInput {
  /** Day to write to (YYYY-MM-DD). Defaults to today in the user's zone. */
  date?: string;
  steps?: number;
  waterMl?: number;
  activeCalories?: number;
  weightKg?: number;
  workoutCompleted?: boolean;
  workoutMinutes?: number;
}

/** One day's metrics. Defaults to today. */
export async function getDay(date?: string): Promise<DailyMetrics> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return api.get<DailyMetrics>(`/api/v1/daily-metrics${query}`);
}

/**
 * Writes the supplied fields for a day and returns it as stored. A partial
 * write, so recording a weigh-in cannot wipe the steps a health-kit sync
 * already wrote.
 */
export async function update(input: UpdateMetricsInput): Promise<DailyMetrics> {
  return api.patch<DailyMetrics>('/api/v1/daily-metrics', input);
}

/**
 * Adds to the day's water total. Relative rather than absolute so two glasses
 * logged in quick succession add up instead of overwriting each other; a
 * negative amount undoes a mistaken tap.
 */
export async function addWater(amountMl: number, date?: string): Promise<DailyMetrics> {
  return api.post<DailyMetrics>('/api/v1/daily-metrics/water', { amountMl, ...(date ? { date } : {}) });
}
