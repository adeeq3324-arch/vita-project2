import { api } from '@/services/api/client';

/**
 * Workout service — logged training sessions.
 *
 * Sessions drive the Fitness chart, the workout component of the health score
 * and three achievements, so a session that exists only in the user's memory is
 * one the whole product cannot credit them for.
 */

export const WORKOUT_TYPES = [
  'strength',
  'cardio',
  'hiit',
  'running',
  'cycling',
  'swimming',
  'walking',
  'yoga',
  'pilates',
  'crossfit',
  'sports',
  'stretching',
  'other',
] as const;

export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const WORKOUT_INTENSITIES = ['low', 'moderate', 'high'] as const;

export type WorkoutIntensity = (typeof WORKOUT_INTENSITIES)[number];

/** Labels for the type chips, in the order the sheet shows them. */
export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  hiit: 'HIIT',
  running: 'Running',
  cycling: 'Cycling',
  swimming: 'Swimming',
  walking: 'Walking',
  yoga: 'Yoga',
  pilates: 'Pilates',
  crossfit: 'CrossFit',
  sports: 'Sports',
  stretching: 'Stretching',
  other: 'Other',
};

export const INTENSITY_LABELS: Record<WorkoutIntensity, string> = {
  low: 'Easy',
  moderate: 'Moderate',
  high: 'Hard',
};

export interface WorkoutLog {
  id: string;
  type: WorkoutType;
  /** Human-readable name of the type ("Strength Training"). */
  typeLabel: string;
  name: string;
  durationMinutes: number;
  /** Ready-made duration label: "45m", "1h 15m". */
  durationLabel: string;
  caloriesBurned: number;
  intensity: WorkoutIntensity;
  /** MaterialCommunityIcons glyph name; resolve with `materialIcon()`. */
  icon: string;
  /** Design-system accent key; resolve with `accentName()`. */
  accent: string;
  time: string;
  performedAt: string;
  date: string;
  dayLabel: string;
  /** Secondary line for list rows: "Today · 6:30 PM · 45m". */
  subtitle: string;
  notes: string | null;
}

/**
 * A session to log. Only `type` and `durationMinutes` are required — the two
 * things the user always knows. Calories are estimated server-side from the
 * type, intensity, duration and body weight unless a wearable knows better.
 */
export interface CreateWorkoutInput {
  type: WorkoutType;
  durationMinutes: number;
  name?: string;
  intensity?: WorkoutIntensity;
  caloriesBurned?: number;
  performedAt?: string;
  date?: string;
  notes?: string;
}

export interface WorkoutTotals {
  sessions: number;
  minutes: number;
  caloriesBurned: number;
}

export interface WorkoutDay {
  date: string;
  dayLabel: string;
  totals: WorkoutTotals;
  workouts: WorkoutLog[];
}

export async function create(input: CreateWorkoutInput): Promise<WorkoutLog> {
  return api.post<WorkoutLog>('/api/v1/workout-logs', input);
}

/** One training day with its sessions and totals. Defaults to today. */
export async function getDay(date?: string): Promise<WorkoutDay> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return api.get<WorkoutDay>(`/api/v1/workout-logs${query}`);
}

export async function remove(id: string): Promise<void> {
  await api.delete<void>(`/api/v1/workout-logs/${id}`);
}
