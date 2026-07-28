import type { AccentColor, WorkoutIntensity, WorkoutType } from '../database/schema';

/**
 * Everything the platform knows about a *kind* of workout: how it is labelled,
 * how it is drawn, and how much energy it costs.
 *
 * One table rather than three so a new workout type cannot be added with a label
 * but no icon, or an icon but no energy cost.
 */
interface WorkoutTypeProfile {
  /** Human-readable name, used when the user does not supply one. */
  label: string;
  /** MaterialCommunityIcons glyph the app renders. */
  icon: string;
  accent: AccentColor;
  /**
   * Metabolic equivalent of task at moderate effort — multiples of resting energy
   * expenditure. Values follow the Compendium of Physical Activities, which is the
   * same reference every credible calorie estimate is built on.
   */
  met: number;
}

const WORKOUT_TYPES: Record<WorkoutType, WorkoutTypeProfile> = {
  strength: { label: 'Strength Training', icon: 'dumbbell', accent: 'violet', met: 5.0 },
  cardio: { label: 'Cardio', icon: 'heart-pulse', accent: 'red', met: 7.0 },
  hiit: { label: 'HIIT', icon: 'lightning-bolt', accent: 'orange', met: 8.5 },
  running: { label: 'Running', icon: 'run-fast', accent: 'green', met: 9.8 },
  cycling: { label: 'Cycling', icon: 'bike', accent: 'cyan', met: 7.5 },
  swimming: { label: 'Swimming', icon: 'swim', accent: 'cyan', met: 8.3 },
  walking: { label: 'Walking', icon: 'walk', accent: 'green', met: 3.5 },
  yoga: { label: 'Yoga', icon: 'meditation', accent: 'pink', met: 3.0 },
  pilates: { label: 'Pilates', icon: 'human-handsup', accent: 'pink', met: 3.8 },
  crossfit: { label: 'CrossFit', icon: 'weight-lifter', accent: 'orange', met: 8.0 },
  sports: { label: 'Sports', icon: 'basketball', accent: 'orange', met: 7.0 },
  stretching: { label: 'Stretching', icon: 'yoga', accent: 'neutral', met: 2.3 },
  other: { label: 'Workout', icon: 'dumbbell', accent: 'violet', met: 4.5 },
};

/**
 * How intensity scales the MET value.
 *
 * A single multiplier per band rather than a second table of MET values: the
 * ratio between an easy and a hard session is roughly constant across activities,
 * and one number per band is far easier to keep honest than thirty-nine.
 */
const INTENSITY_FACTOR: Record<WorkoutIntensity, number> = {
  low: 0.75,
  moderate: 1,
  high: 1.3,
};

/** Fallback body mass when the user has no profile yet, kilograms. */
const DEFAULT_WEIGHT_KG = 70;

export function workoutTypeLabel(type: WorkoutType): string {
  return WORKOUT_TYPES[type].label;
}

export function workoutTypeIcon(type: WorkoutType): string {
  return WORKOUT_TYPES[type].icon;
}

export function workoutTypeAccent(type: WorkoutType): AccentColor {
  return WORKOUT_TYPES[type].accent;
}

/** Every workout type with its presentation, for a client-side type picker. */
export function workoutTypeCatalog(): {
  type: WorkoutType;
  label: string;
  icon: string;
  accent: AccentColor;
}[] {
  return (Object.keys(WORKOUT_TYPES) as WorkoutType[]).map((type) => ({
    type,
    label: WORKOUT_TYPES[type].label,
    icon: WORKOUT_TYPES[type].icon,
    accent: WORKOUT_TYPES[type].accent,
  }));
}

/**
 * Estimates the energy a session burned, kilocalories.
 *
 * Uses the standard MET equation — `kcal/min = MET × 3.5 × kg / 200` — scaled by
 * the intensity band. It is an estimate and is labelled as one to the user, but it
 * is a *principled* one: it responds correctly to body mass, duration and effort,
 * which is what makes the resulting trend meaningful even where the absolute
 * figure is approximate.
 *
 * Only used when the client sends no value of its own; a wearable's reading is
 * always better than a formula and is taken as given.
 */
export function estimateCaloriesBurned(input: {
  type: WorkoutType;
  intensity: WorkoutIntensity;
  durationMinutes: number;
  weightKg: number | null;
}): number {
  const met = WORKOUT_TYPES[input.type].met * INTENSITY_FACTOR[input.intensity];
  const weight = input.weightKg && input.weightKg > 0 ? input.weightKg : DEFAULT_WEIGHT_KG;

  return Math.round(((met * 3.5 * weight) / 200) * input.durationMinutes);
}
