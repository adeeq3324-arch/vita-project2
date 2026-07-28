import { bmiBand } from '../analytics/weight';
import type { ProgressSnapshot, SnapshotPeriod } from '../database/schema';

/**
 * A persisted period roll-up as the client renders it.
 *
 * Grouped by domain rather than served as the flat row, because the row is wide
 * and its consumers are not: a body-composition chart reads `body`, a nutrition
 * trend reads `nutrition`, and neither has to know the column layout. Numerics come
 * back as numbers, never the strings Postgres hands back for `numeric`.
 */
export interface ProgressSnapshotView {
  id: string;
  period: SnapshotPeriod;
  periodStart: string;
  periodEnd: string;
  /** Human label for an axis or a list row: "Week of 12 May", "May 2026". */
  label: string;

  weight: {
    startKg: number | null;
    endKg: number | null;
    /** `end - start`; negative means weight was lost. */
    deltaKg: number | null;
    bmi: number | null;
    /** WHO band for `bmi` ("normal"); null alongside a null BMI. */
    bmiBand: string | null;
  };

  /** User-reported measurements. Every field is null until they record it. */
  body: {
    bodyFatPercent: number | null;
    muscleMassPercent: number | null;
    waistCm: number | null;
    chestCm: number | null;
    hipsCm: number | null;
    armCm: number | null;
    thighCm: number | null;
  };

  /** Daily averages across the period. */
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    waterMl: number;
  };

  activity: {
    avgSteps: number;
    workoutCount: number;
    workoutMinutes: number;
    workoutCaloriesBurned: number;
  };

  /** Mean score over the days that could be scored; null when none could. */
  avgHealthScore: number | null;
  daysLogged: number;
  streakDays: number;
  computedAt: string;
}

/** Reads a nullable `numeric` column, rounded to one decimal. */
const num1 = (value: string | null): number | null =>
  value === null ? null : Math.round(Number(value) * 10) / 10;

export function toProgressSnapshotView(snapshot: ProgressSnapshot): ProgressSnapshotView {
  const bmi = num1(snapshot.bmi);

  return {
    id: snapshot.id,
    period: snapshot.period,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    label: snapshotLabel(snapshot.period, snapshot.periodStart),

    weight: {
      startKg: num1(snapshot.weightStartKg),
      endKg: num1(snapshot.weightEndKg),
      deltaKg: num1(snapshot.weightDeltaKg),
      bmi,
      bmiBand: bmi === null ? null : bmiBand(bmi),
    },

    body: {
      bodyFatPercent: num1(snapshot.bodyFatPercent),
      muscleMassPercent: num1(snapshot.muscleMassPercent),
      waistCm: num1(snapshot.waistCm),
      chestCm: num1(snapshot.chestCm),
      hipsCm: num1(snapshot.hipsCm),
      armCm: num1(snapshot.armCm),
      thighCm: num1(snapshot.thighCm),
    },

    nutrition: {
      calories: Math.round(Number(snapshot.avgCalories)),
      protein: Math.round(Number(snapshot.avgProteinG)),
      carbs: Math.round(Number(snapshot.avgCarbsG)),
      fat: Math.round(Number(snapshot.avgFatG)),
      fiber: Math.round(Number(snapshot.avgFiberG)),
      waterMl: snapshot.avgWaterMl,
    },

    activity: {
      avgSteps: snapshot.avgSteps,
      workoutCount: snapshot.workoutCount,
      workoutMinutes: snapshot.workoutMinutes,
      workoutCaloriesBurned: snapshot.workoutCaloriesBurned,
    },

    avgHealthScore: snapshot.avgHealthScore,
    daysLogged: snapshot.daysLogged,
    streakDays: snapshot.streakDays,
    computedAt: snapshot.computedAt.toISOString(),
  };
}

/**
 * "Week of 12 May" / "May 2026".
 *
 * Formatted from a midday UTC instant so the date cannot slip either side of
 * midnight while being rendered, and pinned to the UTC zone because the value is
 * already the user's local calendar date.
 */
export function snapshotLabel(period: SnapshotPeriod, periodStart: string): string {
  const instant = new Date(`${periodStart}T12:00:00Z`);

  if (period === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    }).format(instant);
  }

  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(instant);

  return `Week of ${day}`;
}
