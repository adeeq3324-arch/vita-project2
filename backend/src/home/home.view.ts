import type { Goal } from '../database/schema';

/**
 * The Home tab's entire payload, in one response.
 *
 * The dashboard renders six metric tiles, an activities checklist, a health
 * score with its week-long trend and a progress summary. Fetching those
 * separately would mean five or six round trips on every app open — and, worse,
 * a dashboard that can render internally inconsistent state when one call
 * resolves against a different moment than the next. Assembling it server-side
 * makes the whole screen a single, atomic read.
 */

/** One tile in the daily overview grid. */
export interface HomeMetricView {
  /** Stable identifier: `calories`, `protein`, `carbs`, `fat`, `water`, `steps`. */
  key: string;
  label: string;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  /** Design-system metric colour key. */
  metric: string;
  value: number;
  target: number;
  unit: string;
  /** Decimal places the value should be shown to. */
  decimals: number;
  /** 0–1 completion, already clamped for the tile's progress bar. */
  progress: number;
}

/** One row in the activities checklist. */
export interface HomeActivityView {
  key: string;
  label: string;
  /** Secondary line, e.g. "3 of 4 logged". */
  detail: string;
  icon: string;
  accent: string;
  done: boolean;
}

export interface HomeHealthScoreView {
  value: number | null;
  max: number;
  caption: string | null;
  /** Change against the preceding days in the trend window. */
  delta: number | null;
  deltaLabel: string;
  /** Daily scores, oldest to newest; null on days that could not be scored. */
  trend: (number | null)[];
  /** Short weekday label per trend point ("Mon"). */
  trendLabels: string[];
}

export interface HomeProgressView {
  weight: {
    /** Latest known body weight, kg. */
    current: number | null;
    /** Weight at the start of the comparison window, kg. */
    start: number | null;
    /** Target weight from the user's goal, kg. */
    target: number | null;
    /** Change since `start`, kg. Negative means weight lost. */
    delta: number | null;
    /** True when `delta` moves the user toward their target. */
    positive: boolean;
    unit: 'kg';
  };
  goal: {
    primaryGoal: Goal['primaryGoal'] | null;
    label: string;
    /** 0–100 progress toward the target weight; null when there is no target. */
    percent: number | null;
  };
  streak: {
    label: string;
    /** Consecutive days up to today with at least one logged meal. */
    value: number;
  };
}

export interface HomeFeedView {
  /** The day this feed describes (YYYY-MM-DD, in the user's time zone). */
  date: string;
  /** "Today" / "Yesterday" / weekday / "12 Mar". */
  dayLabel: string;
  /** First name, for the header greeting. */
  name: string;

  healthScore: HomeHealthScoreView;

  /** The six overview tiles: calories, protein, carbs, fat, water, steps. */
  metrics: HomeMetricView[];

  activities: HomeActivityView[];
  /** How many of `activities` are complete — the "3/4 Completed" chip. */
  activitiesCompleted: number;

  /** Raw intake for the day, for clients that want the numbers directly. */
  intake: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    mealCount: number;
  };

  /** The targets every tile is measured against. Null before onboarding. */
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    waterMl: number;
    steps: number;
    mealsPerDay: number;
  } | null;

  progress: HomeProgressView;
}
