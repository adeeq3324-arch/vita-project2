import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { AccentName } from '@/theme';
import type { MetricName } from '@/theme';

/**
 * Mock Home-screen content. Stands in for the API until the backend lands —
 * shapes here mirror what those endpoints will return, so screens don't change
 * when the data goes live.
 *
 * Every section is day-aware: the exported constants describe *today*, and the
 * `...For(date)` selectors return that same content for today and a deterministic
 * variation for any other day, so selecting a day in the week strip flows through
 * to the whole feed.
 */

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Full weekday names indexed by `Date.getDay()` (0 = Sunday). */
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** "Today" for the current day, otherwise the full weekday name. */
export function dayLabel(date: Date): string {
  return isToday(date) ? 'Today' : WEEKDAY_FULL[date.getDay()]!;
}

/** Deterministic 0–1 value from a date + salt, so a given day always renders the same. */
function seed(date: Date, salt: number): number {
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  const x = Math.sin(dayNumber * 12.9898 + salt * 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

// ── Health score ────────────────────────────────────────────────────────────

function scoreCaption(value: number): string {
  if (value >= 90) return 'Excellent';
  if (value >= 78) return 'Great';
  if (value >= 65) return 'Good';
  return 'Fair';
}

export const healthScore = {
  value: 92,
  max: 100,
  caption: 'Excellent',
  /** Change vs the previous 7 days, shown under the score. */
  delta: 4,
  deltaLabel: 'vs last 7 days',
  /** One point per weekday, Sat → Fri, plotted on the trend chart. */
  trend: [55, 50, 62, 58, 70, 74, 92],
  trendLabels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
};

export function healthScoreFor(date: Date): typeof healthScore {
  if (isToday(date)) return healthScore;
  const value = Math.round(62 + seed(date, 10) * 33); // 62–95
  const delta = Math.round((seed(date, 11) - 0.4) * 12); // ~ -5 … +7
  return { ...healthScore, value, caption: scoreCaption(value), delta };
}

// ── Daily metrics (overview grid) ─────────────────────────────────────────────

export type Metric = {
  key: string;
  label: string;
  icon: IconName;
  metric: MetricName;
  value: string;
  target: string;
  /** 0–1, drives the tile's mini progress bar. */
  progress: number;
};

type MetricBase = {
  key: string;
  label: string;
  icon: IconName;
  metric: MetricName;
  value: number;
  target: number;
  unit: string;
  decimals?: number;
};

const metricBases: MetricBase[] = [
  { key: 'calories', label: 'Calories', icon: 'fire', metric: 'calories', value: 1820, target: 2300, unit: 'kcal' },
  { key: 'protein', label: 'Protein', icon: 'food-drumstick', metric: 'protein', value: 122, target: 100, unit: 'g' },
  { key: 'carbs', label: 'Carbs', icon: 'bread-slice', metric: 'carbs', value: 165, target: 220, unit: 'g' },
  { key: 'fat', label: 'Fat', icon: 'water', metric: 'fat', value: 56, target: 70, unit: 'g' },
  { key: 'water', label: 'Water', icon: 'cup-water', metric: 'water', value: 2.1, target: 4, unit: 'L', decimals: 1 },
  { key: 'steps', label: 'Steps', icon: 'shoe-print', metric: 'steps', value: 8642, target: 10000, unit: '' },
];

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function toMetric(base: MetricBase, value: number): Metric {
  const rounded = base.decimals ? Math.round(value * 10) / 10 : Math.round(value);
  return {
    key: base.key,
    label: base.label,
    icon: base.icon,
    metric: base.metric,
    value: fmt(rounded, base.decimals ?? 0),
    target: `/ ${fmt(base.target, 0)}${base.unit ? ` ${base.unit}` : ''}`,
    progress: base.target ? rounded / base.target : 0,
  };
}

export const dailyMetrics: Metric[] = metricBases.map((base) => toMetric(base, base.value));

export function dailyMetricsFor(date: Date): Metric[] {
  if (isToday(date)) return dailyMetrics;
  return metricBases.map((base, index) => {
    const factor = 0.5 + seed(date, index + 1) * 0.55; // 0.50 – 1.05 of target
    return toMetric(base, base.value * factor);
  });
}

// ── Activities ────────────────────────────────────────────────────────────────

export type Activity = {
  key: string;
  label: string;
  detail: string;
  icon: IconName;
  accent: AccentName;
  done: boolean;
};

export const activities: Activity[] = [
  { key: 'meals', label: 'Meals', detail: '3 of 4 logged', icon: 'silverware-fork-knife', accent: 'red', done: true },
  { key: 'workout', label: 'Workout', detail: 'Upper body · 45 min', icon: 'dumbbell', accent: 'cyan', done: true },
  { key: 'supplements', label: 'Supplements', detail: 'Morning stack taken', icon: 'pill', accent: 'green', done: true },
  { key: 'reminders', label: 'Reminders', detail: '1 pending · Evening walk', icon: 'bell-ring', accent: 'orange', done: false },
];

export function activitiesFor(date: Date): Activity[] {
  if (isToday(date)) return activities;
  return activities.map((activity, index) => ({ ...activity, done: seed(date, 20 + index) > 0.4 }));
}

export function completedCount(items: Activity[]): number {
  return items.filter((item) => item.done).length;
}

// ── AI insight ────────────────────────────────────────────────────────────────

export const aiInsight = {
  title: 'AI Insight',
  message:
    'Great job hitting your protein goal! Try adding more leafy greens today to boost your fiber intake.',
};

const insightByWeekday: string[] = [
  'A lighter Sunday is perfect for meal prep — batch your protein for the week ahead.',
  'Start the week strong: hit your water target early to stay sharp through the day.',
  'Your steps dipped last Tuesday — a short walk after lunch keeps momentum going.',
  'Midweek check-in: you are on track. Add leafy greens to round out your fiber.',
  'Recovery matters — aim for an earlier night to protect tomorrow\'s workout.',
  'Great work this week! Keep carbs moderate to finish the week feeling light.',
  'Weekend fuel: balance treats with protein so you stay within your calorie goal.',
];

export function aiInsightFor(date: Date): typeof aiInsight {
  if (isToday(date)) return aiInsight;
  return { title: aiInsight.title, message: insightByWeekday[date.getDay()]! };
}

// ── Progress overview ─────────────────────────────────────────────────────────

export const progressOverview = {
  weight: { value: '72.4', unit: 'kg', delta: '-4.2 kg', positive: true },
  goal: { label: 'Goal progress', percent: 68 },
  streak: { label: 'Day streak', value: 12 },
};

export function progressOverviewFor(date: Date): typeof progressOverview {
  if (isToday(date)) return progressOverview;
  const weight = (71.5 + seed(date, 32) * 2.5).toFixed(1); // 71.5 – 74.0
  const lost = (1 + seed(date, 33) * 5).toFixed(1); // 1.0 – 6.0 kg
  const percent = Math.round(50 + seed(date, 34) * 45); // 50 – 95 %
  const streak = Math.max(1, Math.round(seed(date, 35) * 20));
  return {
    weight: { value: weight, unit: 'kg', delta: `-${lost} kg`, positive: true },
    goal: { label: 'Goal progress', percent },
    streak: { label: 'Day streak', value: streak },
  };
}

// ── Motivation ────────────────────────────────────────────────────────────────

export const motivation = {
  quote: 'The body achieves what the mind believes.',
  author: 'Stay consistent, Ahmed',
};

const quoteByWeekday: string[] = [
  'Rest is part of the work. Recover well, come back stronger.',
  'A strong week starts with a single good choice.',
  'Small steps every day add up to big results.',
  'Discipline is choosing what you want most over what you want now.',
  'You are closer than you were yesterday.',
  'Finish the week proud of the effort you gave.',
  'Consistency on the weekend is what sets you apart.',
];

export function motivationFor(date: Date): typeof motivation {
  if (isToday(date)) return motivation;
  return { quote: quoteByWeekday[date.getDay()]!, author: motivation.author };
}
