import type { DailySeriesPoint } from '../analytics/daily-series';

/**
 * Turning a day-by-day series into the series a chart draws.
 *
 * The two periods need genuinely different treatment. A week has few enough days
 * to plot one point each; a month has too many to be legible, so it is bucketed —
 * and *how* it is bucketed differs per chart, because the question each answers
 * differs. Calories and water want a daily average per bucket ("what was a typical
 * day like?"), while workouts want a total ("how many sessions that week?").
 *
 * Everything here is pure: given the same series it produces the same chart, which
 * is what makes the shapes safe to cache.
 */

/** Points plotted on the monthly weight line. Enough for a trend, few enough to read. */
const MONTH_WEIGHT_POINTS = 7;

/** Days per bucket on the monthly intake charts — weekly quarters of a 28-day window. */
const MONTH_INTAKE_BUCKET_DAYS = 4;

/** Days per bucket on the workout-frequency chart for a month: whole weeks. */
const WORKOUT_BUCKET_DAYS = 7;

/**
 * Sparse axis labels for a series of `length` points.
 *
 * A weekly chart shows four labels across seven points rather than all seven,
 * because seven weekday names do not fit the card's width — the same compromise
 * the designs make. The first and last points are always labelled so the axis is
 * anchored at both ends.
 */
export function sparseLabels(
  length: number,
  count: number,
  labelAt: (index: number) => string,
): string[] {
  if (length === 0) {
    return [];
  }
  if (length <= count) {
    return Array.from({ length }, (_, index) => labelAt(index));
  }

  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, slot) => labelAt(Math.round(slot * step)));
}

/**
 * Splits `days` into contiguous buckets of at most `size`, oldest first.
 *
 * A trailing partial bucket is kept rather than dropped: it is the most recent
 * data, which is the last thing a user would want silently omitted.
 */
export function bucketDays(
  days: readonly DailySeriesPoint[],
  size: number,
): DailySeriesPoint[][] {
  const buckets: DailySeriesPoint[][] = [];
  for (let offset = 0; offset < days.length; offset += size) {
    buckets.push(days.slice(offset, offset + size));
  }
  return buckets;
}

/**
 * The weight line.
 *
 * Weigh-ins are sparse — most users step on the scales a couple of times a week —
 * so the series is built by carrying the last known value forward and back-filling
 * the days before the first one. That produces the unbroken line the chart draws
 * without inventing movement that did not happen: a flat stretch means "no new
 * measurement", which is exactly what it looked like to the user.
 *
 * Returns an empty series when there is no weight information at all, so the client
 * can hide the card rather than draw a line at zero.
 */
export function buildWeightSeries(
  days: readonly DailySeriesPoint[],
  fallbackKg: number | null,
  points: number,
): number[] {
  const filled: (number | null)[] = [];
  let last: number | null = null;

  for (const day of days) {
    if (day.weightKg !== null) {
      last = day.weightKg;
    }
    filled.push(last);
  }

  // Back-fill the leading gap with the first known weight, or the profile's.
  const first = filled.find((value) => value !== null) ?? fallbackKg;
  if (first === null || first === undefined) {
    return [];
  }

  const series = filled.map((value) => value ?? first);
  return points >= series.length ? series : sampleEvenly(series, points);
}

/**
 * Picks `count` values spread evenly across `series`, always including both ends.
 *
 * Sampling rather than averaging, because a weight line should pass through real
 * measurements: an averaged point sits between two weights the user never had.
 */
export function sampleEvenly(series: readonly number[], count: number): number[] {
  if (series.length <= count || count < 2) {
    return [...series];
  }

  const step = (series.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, slot) => series[Math.round(slot * step)]);
}

/** Daily values, or per-bucket daily averages when the window is a month. */
export function buildIntakeSeries(
  days: readonly DailySeriesPoint[],
  period: 'week' | 'month',
  pick: (day: DailySeriesPoint) => number,
  round: (value: number) => number,
): number[] {
  if (period === 'week') {
    return days.map((day) => round(pick(day)));
  }

  return bucketDays(days, MONTH_INTAKE_BUCKET_DAYS).map((bucket) =>
    round(bucket.reduce((total, day) => total + pick(day), 0) / bucket.length),
  );
}

/**
 * Session counts: one bar per day over a week, one per whole week over a month.
 *
 * Totals rather than averages, because "four sessions that week" is the figure a
 * user recognises; an average of 0.57 sessions a day is not.
 */
export function buildWorkoutSeries(
  days: readonly DailySeriesPoint[],
  period: 'week' | 'month',
): number[] {
  if (period === 'week') {
    return days.map((day) => day.workouts.sessions);
  }

  return bucketDays(days, WORKOUT_BUCKET_DAYS).map((bucket) =>
    bucket.reduce((total, day) => total + day.workouts.sessions, 0),
  );
}

/** "W1" … "Wn" for the monthly frequency chart's weekly buckets. */
export function weekBucketLabels(dayCount: number): string[] {
  const buckets = Math.ceil(dayCount / WORKOUT_BUCKET_DAYS);
  return Array.from({ length: buckets }, (_, index) => `W${index + 1}`);
}

/** Points the monthly weight line is sampled down to. */
export const MONTH_WEIGHT_SERIES_POINTS = MONTH_WEIGHT_POINTS;
