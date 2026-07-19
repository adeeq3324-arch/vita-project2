import type { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '@/theme';

/**
 * Mock Progress-screen content. Mirrors the shape of the analytics endpoints
 * that will replace it, so the screen is unchanged when the data goes live.
 */

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export type ProgressPeriod = 'week' | 'month';

type PeriodCharts = {
  weight: { data: number[]; labels: string[]; delta: string; positive: boolean };
  calories: { data: number[]; average: string; target: string };
  water: { data: number[]; today: string; target: string };
  workout: { data: number[]; labels: string[] };
};

export const chartData: Record<ProgressPeriod, PeriodCharts> = {
  week: {
    weight: {
      data: [74.1, 73.8, 73.9, 73.2, 72.9, 72.6, 72.4],
      labels: ['Mon', 'Wed', 'Fri', 'Sun'],
      delta: '-1.7 kg',
      positive: true,
    },
    calories: { data: [1720, 2010, 1880, 1650, 2150, 1920, 1820], average: '1,880', target: '2,200 kcal' },
    water: { data: [1.8, 2.4, 2.0, 2.6, 1.9, 2.2, 2.1], today: '2.1 L', target: '3 L' },
    workout: { data: [1, 0, 1, 1, 0, 1, 1], labels: ['Mon', 'Wed', 'Fri', 'Sun'] },
  },
  month: {
    weight: {
      data: [76.6, 75.9, 74.8, 74.1, 73.4, 72.9, 72.4],
      labels: ['May 1', 'May 15', 'May 30'],
      delta: '-4.2 kg',
      positive: true,
    },
    calories: { data: [1980, 1870, 2040, 1760, 1910, 2100, 1850, 1990], average: '1,930', target: '2,200 kcal' },
    water: { data: [2.0, 2.3, 1.9, 2.5, 2.1, 2.4, 2.2, 2.0], today: '2.2 L', target: '3 L' },
    workout: { data: [4, 3, 5, 4], labels: ['W1', 'W2', 'W3', 'W4'] },
  },
};

export const healthScore = {
  value: 92,
  caption: 'Excellent',
  vsLast: '+6 vs last month',
};

export type BodyStat = { key: string; label: string; value: string; unit: string; icon: IconName };

export const bodyStats: BodyStat[] = [
  { key: 'bmi', label: 'BMI', value: '22.4', unit: 'normal', icon: 'human' },
  { key: 'bodyfat', label: 'Body Fat', value: '18', unit: '%', icon: 'water-percent' },
  { key: 'muscle', label: 'Muscle', value: '41', unit: '%', icon: 'arm-flex' },
];

export type MacroLegend = { key: string; label: string; grams: number; percent: number; color: string };

export const macros: MacroLegend[] = [
  { key: 'protein', label: 'Protein', grams: 122, percent: 27, color: colors.metric.protein },
  { key: 'carbs', label: 'Carbs', grams: 165, percent: 37, color: colors.metric.carbs },
  { key: 'fat', label: 'Fat', grams: 56, percent: 25, color: colors.metric.fat },
  { key: 'fiber', label: 'Fiber', grams: 25, percent: 11, color: colors.metric.fiber },
];

export const fitnessStats = {
  sessions: { label: 'Sessions', value: '18', hint: 'this month' },
  streak: { label: 'Streak', value: '12', hint: 'days in a row' },
  duration: { label: 'Avg time', value: '45m', hint: 'per workout' },
};

export type Achievement = {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  unlocked: boolean;
};

export const achievements: Achievement[] = [
  { key: 'streak', label: '7-Day Streak', icon: 'fire', color: colors.accent.orange, unlocked: true },
  { key: 'hydrated', label: 'Hydrated', icon: 'cup-water', color: colors.accent.cyan, unlocked: true },
  { key: 'protein', label: 'Protein Pro', icon: 'food-drumstick', color: colors.accent.violet, unlocked: true },
  { key: 'marathon', label: 'Marathoner', icon: 'run-fast', color: colors.accent.green, unlocked: false },
  { key: 'earlybird', label: 'Early Bird', icon: 'weather-sunset-up', color: colors.accent.pink, unlocked: false },
];

export type Milestone = { key: string; label: string; detail: string; percent: number };

export const milestones: Milestone[] = [
  { key: 'weight', label: 'Lose 5 kg', detail: '4.2 of 5 kg', percent: 84 },
  { key: 'streak', label: '30-day streak', detail: '12 of 30 days', percent: 40 },
  { key: 'workouts', label: '50 workouts', detail: '18 of 50', percent: 36 },
];

export type Tip = { key: string; icon: IconName; color: string; title: string; body: string };

export const tips: Tip[] = [
  {
    key: 'protein',
    icon: 'food-drumstick',
    color: colors.accent.violet,
    title: 'Spread your protein',
    body: 'Aim for 25–30g of protein per meal to support muscle recovery through the day.',
  },
  {
    key: 'water',
    icon: 'cup-water',
    color: colors.accent.cyan,
    title: 'Hydrate earlier',
    body: 'You often fall short in the morning. A glass of water on waking closes most of the gap.',
  },
  {
    key: 'sleep',
    icon: 'moon-waning-crescent',
    color: colors.accent.orange,
    title: 'Guard your sleep',
    body: 'Consistent 7–8h nights improve recovery and appetite control more than any supplement.',
  },
];
