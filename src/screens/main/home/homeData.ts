import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { AccentName } from '@/theme';
import type { MetricName } from '@/theme';

/**
 * Mock Home-screen content. Stands in for the API until the backend lands —
 * shapes here mirror what those endpoints will return, so screens don't change
 * when the data goes live.
 */

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

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

export const healthScore = {
  value: 92,
  caption: 'Excellent',
  message: "You're doing amazing\nKeep it up!",
  trend: [70, 74, 72, 78, 83, 80, 88, 92],
};

export const dailyMetrics: Metric[] = [
  { key: 'calories', label: 'Calories', icon: 'fire', metric: 'calories', value: '1,820', target: '/ 2,300 kcal', progress: 0.79 },
  { key: 'protein', label: 'Protein', icon: 'food-drumstick', metric: 'protein', value: '122', target: '/ 100 g', progress: 1 },
  { key: 'carbs', label: 'Carbs', icon: 'bread-slice', metric: 'carbs', value: '165', target: '/ 220 g', progress: 0.75 },
  { key: 'fat', label: 'Fat', icon: 'water', metric: 'fat', value: '56', target: '/ 70 g', progress: 0.8 },
  { key: 'water', label: 'Water', icon: 'cup-water', metric: 'water', value: '2.1', target: '/ 4 L', progress: 0.53 },
  { key: 'steps', label: 'Steps', icon: 'shoe-print', metric: 'steps', value: '8,642', target: '/ 10,000', progress: 0.86 },
];

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

export const aiInsight = {
  title: 'AI Insight',
  message:
    'Great job hitting your protein goal! Try adding more leafy greens today to boost your fiber intake.',
};

export const progressOverview = {
  weight: { value: '72.4', unit: 'kg', delta: '-4.2 kg', positive: true },
  goal: { label: 'Goal progress', percent: 68 },
  streak: { label: 'Day streak', value: 12 },
};

export const motivation = {
  quote: 'The body achieves what the mind believes.',
  author: 'Stay consistent, Ahmed',
};
