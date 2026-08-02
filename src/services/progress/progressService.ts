import { api } from '@/services/api/client';

/**
 * Progress service — the analytics tab for one segment, in one call.
 *
 * `GET /api/v1/progress` returns every chart, the measurement row, the macro
 * legend, the badge rail and the milestone bars together. Eight separate reads
 * would let the screen fill in piecemeal and let one card describe a different
 * window than the card beside it.
 */

export type ProgressPeriod = 'week' | 'month';

export interface ProgressHealthScore {
  /** Mean score over the period; null when no day could be scored. */
  value: number | null;
  max: number;
  caption: string | null;
  delta: number | null;
  /** Ready-made label: "+6 vs last month". */
  vsLast: string | null;
}

export interface ProgressCharts {
  weight: {
    data: number[];
    labels: string[];
    /** Signed change over the period: "-1.7 kg". */
    delta: string;
    /** True when the change is the direction the user wants. */
    positive: boolean;
    unit: 'kg';
  };
  calories: {
    data: number[];
    /** Mean daily intake, formatted: "1,880". */
    average: string;
    /** The target it is measured against: "2,200 kcal". */
    target: string;
  };
  /** Daily fluid intake in litres. */
  water: {
    data: number[];
    today: string;
    target: string;
  };
  /** Sessions per bucket. */
  workout: {
    data: number[];
    labels: string[];
  };
}

/** One tile in the body-measurement row. */
export interface BodyStat {
  key: 'bmi' | 'bodyfat' | 'muscle';
  label: string;
  /** Pre-formatted, or "—" when never recorded. */
  value: string;
  unit: string;
  icon: string;
  /** False when the figure is unknown, so it can be styled as absent. */
  available: boolean;
}

/** One row of the macro donut's legend. */
export interface MacroLegend {
  key: 'protein' | 'carbs' | 'fat' | 'fiber';
  label: string;
  /** Design-system metric key; resolve with `metricName()`. */
  metric: string;
  /** Mean daily grams over the period. */
  grams: number;
  /** Share of the four macros' combined mass, whole percent. */
  percent: number;
}

export interface FitnessStat {
  label: string;
  value: string;
  hint: string;
}

export interface FitnessStats {
  sessions: FitnessStat;
  streak: FitnessStat;
  duration: FitnessStat;
}

/** A badge or a milestone — the same record, read differently by each surface. */
export interface Achievement {
  key: string;
  label: string;
  description: string;
  icon: string;
  /** Design-system accent key; resolve with `accentName()`. */
  accent: string;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
  /** Completion, 0–100. */
  percent: number;
  /** "4.2 of 5 kg", "12 of 30 days". */
  detail: string;
}

export interface ProgressOverview {
  period: ProgressPeriod;
  /** Window covered, inclusive (YYYY-MM-DD). */
  from: string;
  to: string;
  healthScore: ProgressHealthScore;
  charts: ProgressCharts;
  bodyStats: BodyStat[];
  macros: MacroLegend[];
  fitnessStats: FitnessStats;
  achievements: Achievement[];
  milestones: Achievement[];
}

/** Reads the Progress tab for one segment. */
export async function getOverview(period: ProgressPeriod): Promise<ProgressOverview> {
  return api.get<ProgressOverview>(`/api/v1/progress?period=${period}`);
}
