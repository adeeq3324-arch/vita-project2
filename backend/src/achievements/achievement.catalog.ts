import type {
  AccentColor,
  AchievementCategory,
  AchievementSurface,
  Goal,
} from '../database/schema';

/**
 * Every measurable thing an achievement can be earned against.
 *
 * Achievements are declarative precisely because of this indirection: a definition
 * names a metric and a target, and the evaluator computes each metric exactly
 * once for the user. Adding a badge is a row in the catalogue below; adding a
 * *new kind* of badge is one more field here plus the line that computes it.
 */
export interface AchievementMetrics {
  /** Consecutive days ending today with something logged. */
  loggingStreakDays: number;
  /** Consecutive days ending today with a training session. */
  workoutStreakDays: number;
  /** Consecutive days ending today that met the fluid target. */
  hydrationStreakDays: number;
  /** Consecutive days ending today scoring 90 or better. */
  perfectDayStreak: number;
  /** Days in the lookback window that met the protein target. */
  proteinDaysMet: number;
  /** All-time training sessions. */
  totalWorkouts: number;
  /** All-time minutes trained. */
  totalWorkoutMinutes: number;
  /** All-time sessions started before 8am local time. */
  earlyWorkouts: number;
  /** Kilograms moved toward the goal weight; never negative. */
  weightProgressKg: number;
  /** Kilograms between the starting weight and the goal; 0 when there is no goal. */
  weightGoalDistanceKg: number;
}

export type AchievementMetricKey = keyof AchievementMetrics;

/**
 * A target that is personal rather than fixed — the distance to *this* user's goal
 * weight, for instance. A definition with a personal target is skipped entirely
 * when the value resolves to zero, because a milestone the user has not set is not
 * one they have failed.
 */
interface PersonalTarget {
  fromMetric: AchievementMetricKey;
}

export interface AchievementDefinition {
  /** Stable key, persisted on the row. Never renamed once shipped. */
  key: string;
  label: string;
  description: string;
  /** MaterialCommunityIcons glyph. */
  icon: string;
  accent: AccentColor;
  category: AchievementCategory;
  surface: AchievementSurface;
  metric: AchievementMetricKey;
  target: number | PersonalTarget;
  /** Unit shown in a milestone's detail line ("days", "kg", ""). */
  unit: string;
  /** Decimal places for the detail line; whole numbers by default. */
  decimals?: number;
  /** Overrides `label` once a personal target is known ("Lose 5 kg"). */
  labelFor?: (target: number, primaryGoal: Goal['primaryGoal'] | null) => string;
}

/**
 * The achievement catalogue.
 *
 * Ordered as the app presents it: badges in the order they are meant to be earned
 * (so the rail reads as a ladder rather than a shuffle), then milestones.
 *
 * Kept in code rather than in a table on purpose — a definition is inseparable
 * from the metric that unlocks it, and splitting the two across a migration
 * boundary invites a catalogue row that no evaluator can ever satisfy. What *is*
 * data is each user's standing against it, which is what the `achievements` table
 * holds.
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  // ── badges ───────────────────────────────────────────────────────────────
  {
    key: 'first_workout',
    label: 'First Session',
    description: 'Log your first workout.',
    icon: 'dumbbell',
    accent: 'violet',
    category: 'fitness',
    surface: 'badge',
    metric: 'totalWorkouts',
    target: 1,
    unit: 'session',
  },
  {
    key: 'streak_7',
    label: '7-Day Streak',
    description: 'Log something every day for a week.',
    icon: 'fire',
    accent: 'orange',
    category: 'streak',
    surface: 'badge',
    metric: 'loggingStreakDays',
    target: 7,
    unit: 'days',
  },
  {
    key: 'hydrated',
    label: 'Hydrated',
    description: 'Hit your water goal seven days running.',
    icon: 'cup-water',
    accent: 'cyan',
    category: 'hydration',
    surface: 'badge',
    metric: 'hydrationStreakDays',
    target: 7,
    unit: 'days',
  },
  {
    key: 'protein_pro',
    label: 'Protein Pro',
    description: 'Meet your protein target on ten days.',
    icon: 'food-drumstick',
    accent: 'violet',
    category: 'nutrition',
    surface: 'badge',
    metric: 'proteinDaysMet',
    target: 10,
    unit: 'days',
  },
  {
    key: 'early_bird',
    label: 'Early Bird',
    description: 'Train before 8am on five occasions.',
    icon: 'weather-sunset-up',
    accent: 'pink',
    category: 'consistency',
    surface: 'badge',
    metric: 'earlyWorkouts',
    target: 5,
    unit: 'sessions',
  },
  {
    key: 'perfect_week',
    label: 'Perfect Week',
    description: 'Score 90 or better seven days in a row.',
    icon: 'trophy-variant',
    accent: 'orange',
    category: 'consistency',
    surface: 'badge',
    metric: 'perfectDayStreak',
    target: 7,
    unit: 'days',
  },
  {
    key: 'marathoner',
    label: 'Marathoner',
    description: 'Train for 1,000 minutes in total.',
    icon: 'run-fast',
    accent: 'green',
    category: 'fitness',
    surface: 'badge',
    metric: 'totalWorkoutMinutes',
    target: 1000,
    unit: 'min',
  },
  {
    key: 'iron_will',
    label: 'Iron Will',
    description: 'Train every day for a fortnight.',
    icon: 'weight-lifter',
    accent: 'red',
    category: 'streak',
    surface: 'badge',
    metric: 'workoutStreakDays',
    target: 14,
    unit: 'days',
  },

  // ── milestones ───────────────────────────────────────────────────────────
  {
    key: 'weight_goal',
    label: 'Weight goal',
    description: 'Reach your target weight.',
    icon: 'scale-bathroom',
    accent: 'cyan',
    category: 'body',
    surface: 'milestone',
    metric: 'weightProgressKg',
    target: { fromMetric: 'weightGoalDistanceKg' },
    unit: 'kg',
    decimals: 1,
    labelFor: (target, primaryGoal) =>
      `${primaryGoal === 'muscle_gain' ? 'Gain' : 'Lose'} ${formatTarget(target)} kg`,
  },
  {
    key: 'streak_30',
    label: '30-day streak',
    description: 'Log something every day for a month.',
    icon: 'calendar-check',
    accent: 'orange',
    category: 'streak',
    surface: 'milestone',
    metric: 'loggingStreakDays',
    target: 30,
    unit: 'days',
  },
  {
    key: 'workouts_50',
    label: '50 workouts',
    description: 'Complete fifty training sessions.',
    icon: 'medal',
    accent: 'green',
    category: 'fitness',
    surface: 'milestone',
    metric: 'totalWorkouts',
    target: 50,
    unit: '',
  },
];

/** Trims a trailing `.0` so "5 kg" never renders as "5.0 kg". */
function formatTarget(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * The target for a definition given a user's metrics, or null when a personal
 * target does not apply to them.
 */
export function resolveTarget(
  definition: AchievementDefinition,
  metrics: AchievementMetrics,
): number | null {
  if (typeof definition.target === 'number') {
    return definition.target;
  }

  const personal = metrics[definition.target.fromMetric];
  return personal > 0 ? personal : null;
}

/** The label for a definition once its target is known. */
export function resolveLabel(
  definition: AchievementDefinition,
  target: number,
  primaryGoal: Goal['primaryGoal'] | null,
): string {
  return definition.labelFor?.(target, primaryGoal) ?? definition.label;
}
