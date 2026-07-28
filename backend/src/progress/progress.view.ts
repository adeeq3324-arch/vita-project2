import type { AchievementView } from '../achievements/achievement.view';
import type { SnapshotPeriod } from '../database/schema';

/**
 * The Progress tab's payload.
 *
 * Field-for-field the shape the screen already renders (`src/screens/main/progress/
 * progressData.ts`): a line series for weight, bar series for calories, water and
 * workout frequency, a circular gauge for the health score, the body-measurement
 * row, the macro donut's legend, and the badge/milestone lists. The client swaps
 * its mock module for this response and changes nothing else.
 *
 * Pre-formatted strings (`average`, `target`, `delta`) sit alongside the raw
 * numbers on purpose — the mock supplied them, the screen renders them directly,
 * and formatting a thousands separator or a signed delta in one place beats doing
 * it identically in every card.
 */
export interface ProgressOverviewView {
  period: SnapshotPeriod;
  from: string;
  to: string;

  healthScore: ProgressHealthScoreView;
  charts: ProgressChartsView;
  bodyStats: BodyStatView[];
  macros: MacroLegendView[];
  fitnessStats: FitnessStatsView;

  /** The badge rail, in catalogue order. */
  achievements: AchievementView[];
  /** Milestone bars with partial progress. */
  milestones: AchievementView[];
}

export interface ProgressHealthScoreView {
  /** Mean score over the period, 0–100; null when no day could be scored. */
  value: number | null;
  max: 100;
  /** Plain-language band ("Excellent"); null alongside a null value. */
  caption: string | null;
  /** Change against the preceding period of the same length; null without one. */
  delta: number | null;
  /** Ready-made label: "+6 vs last month". */
  vsLast: string | null;
}

export interface ProgressChartsView {
  /** Body-weight trend, for the line chart. */
  weight: {
    data: number[];
    /** Sparse axis labels, evenly spread across `data`. */
    labels: string[];
    /** Signed change over the period: "-1.7 kg". */
    delta: string;
    /** True when the change is the direction the user wants. */
    positive: boolean;
    unit: 'kg';
  };
  /** Daily energy intake, for the bar chart. */
  calories: {
    data: number[];
    /** Mean daily intake, formatted: "1,880". */
    average: string;
    /** The target it is measured against: "2,200 kcal". */
    target: string;
  };
  /** Daily fluid intake in litres, for the bar chart. */
  water: {
    data: number[];
    /** The most recent day's intake: "2.1 L". */
    today: string;
    /** The daily goal: "3 L". */
    target: string;
  };
  /** Sessions per bucket, for the frequency bars. */
  workout: {
    data: number[];
    labels: string[];
  };
}

/** One tile in the body-measurement row. */
export interface BodyStatView {
  key: 'bmi' | 'bodyfat' | 'muscle';
  label: string;
  /** Pre-formatted value, or "—" when the user has never recorded it. */
  value: string;
  /** Unit or qualifier shown beneath the value ("%", "normal"). */
  unit: string;
  /** MaterialCommunityIcons glyph. */
  icon: string;
  /** False when the figure is unknown, so the client can style it as absent. */
  available: boolean;
}

/** One row of the macro donut's legend. */
export interface MacroLegendView {
  key: 'protein' | 'carbs' | 'fat' | 'fiber';
  label: string;
  /** Design-system metric key the client maps to a colour. */
  metric: 'protein' | 'carbs' | 'fat' | 'fiber';
  /** Mean daily grams over the period. */
  grams: number;
  /** Share of the four macros' combined mass, whole percent. */
  percent: number;
}

/** A single headline figure with its caption. */
export interface FitnessStatView {
  label: string;
  value: string;
  hint: string;
}

export interface FitnessStatsView {
  sessions: FitnessStatView;
  streak: FitnessStatView;
  duration: FitnessStatView;
}
