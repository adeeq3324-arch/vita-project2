import { api } from '@/services/api/client';
import type { PrimaryGoal } from '@/types';

/**
 * Home service — the dashboard for one day, in one call.
 *
 * The backend assembles the whole tab (`GET /api/v1/home/feed`) rather than
 * exposing a metric endpoint, an activities endpoint and a score endpoint: the
 * screen renders as a unit, and reading it as one row means the tiles can never
 * disagree with the totals beside them.
 */

export interface HomeMetric {
  /** `calories` | `protein` | `carbs` | `fat` | `water` | `steps`. */
  key: string;
  label: string;
  /** MaterialCommunityIcons glyph name; resolve with `materialIcon()`. */
  icon: string;
  /** Design-system metric colour key; resolve with `metricName()`. */
  metric: string;
  value: number;
  target: number;
  unit: string;
  /** Decimal places `value` should be shown to. */
  decimals: number;
  /** 0–1 completion, already clamped by the server. */
  progress: number;
}

export interface HomeActivity {
  key: string;
  label: string;
  /** Secondary line, e.g. "3 of 4 logged". */
  detail: string;
  icon: string;
  /** Design-system accent key; resolve with `accentName()`. */
  accent: string;
  done: boolean;
}

export interface HomeHealthScore {
  /** null until the day has enough logged to be scored. */
  value: number | null;
  max: number;
  caption: string | null;
  delta: number | null;
  deltaLabel: string;
  /** One score per day, oldest first; null on days that could not be scored. */
  trend: (number | null)[];
  trendLabels: string[];
}

export interface HomeProgress {
  weight: {
    current: number | null;
    start: number | null;
    target: number | null;
    /** Change since `start`, kg. Negative means weight lost. */
    delta: number | null;
    /** True when `delta` moves the user toward their target. */
    positive: boolean;
    unit: 'kg';
  };
  goal: {
    primaryGoal: PrimaryGoal | null;
    label: string;
    /** 0–100 toward the target weight; null without a target. */
    percent: number | null;
  };
  streak: {
    label: string;
    value: number;
  };
}

export interface HomeIntake {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  mealCount: number;
}

export interface HomeTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  steps: number;
  mealsPerDay: number;
}

export interface HomeFeed {
  /** The day this feed describes (YYYY-MM-DD, in the user's time zone). */
  date: string;
  /** "Today" / "Yesterday" / weekday / "12 Mar". */
  dayLabel: string;
  /** Display name for the greeting. */
  name: string;
  healthScore: HomeHealthScore;
  metrics: HomeMetric[];
  activities: HomeActivity[];
  activitiesCompleted: number;
  intake: HomeIntake;
  /** Null until onboarding has produced targets. */
  targets: HomeTargets | null;
  progress: HomeProgress;
}

/**
 * Reads the dashboard for `date` (YYYY-MM-DD in the user's time zone). Omit it
 * for today — the server resolves "today" in the user's own zone, which is the
 * only place that knows it.
 */
export async function getFeed(date?: string): Promise<HomeFeed> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return api.get<HomeFeed>(`/api/v1/home/feed${query}`);
}
