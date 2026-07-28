import { dayLabel, toLocalTimeLabel } from '../common/util/date.util';
import type { WorkoutLog } from '../database/schema';
import { workoutTypeLabel } from './workout.presentation';

/**
 * A single logged session as the client renders it.
 *
 * Mirrors the shape the diary rows use elsewhere in the app — `icon`, `accent`,
 * `time`, `subtitle` — so a workout row and a meal row are built from the same
 * fields by the same list components.
 */
export interface WorkoutLogView {
  id: string;
  type: WorkoutLog['type'];
  /** Human-readable name of the type ("Strength Training"). */
  typeLabel: string;
  name: string;
  durationMinutes: number;
  /** Ready-made duration label: "45m", "1h 15m". */
  durationLabel: string;
  caloriesBurned: number;
  intensity: WorkoutLog['intensity'];
  icon: string;
  accent: WorkoutLog['accent'];
  /** Local clock time, e.g. "6:30 PM". */
  time: string;
  /** Exact instant, ISO-8601 — for clients that format it themselves. */
  performedAt: string;
  /** The user's local calendar day this session belongs to (YYYY-MM-DD). */
  date: string;
  /** "Today" / "Yesterday" / weekday / "12 Mar", relative to the user's today. */
  dayLabel: string;
  /** Secondary line for list rows: "Today · 6:30 PM · 45m". */
  subtitle: string;
  notes: string | null;
}

/** Totals for a set of sessions. */
export interface WorkoutTotals {
  sessions: number;
  minutes: number;
  caloriesBurned: number;
}

/** A full training day: its sessions plus the day's totals. */
export interface WorkoutDayView {
  date: string;
  dayLabel: string;
  totals: WorkoutTotals;
  workouts: WorkoutLogView[];
}

/** One day's roll-up in workout history, without the individual sessions. */
export interface WorkoutHistoryDayView {
  date: string;
  dayLabel: string;
  totals: WorkoutTotals;
}

/**
 * Headline training stats over a window — the three figures the Progress tab's
 * Fitness card shows, plus the breakdown behind them.
 */
export interface WorkoutSummaryView {
  from: string;
  to: string;
  totals: WorkoutTotals;
  /** Mean session length over the window, minutes; 0 when nothing was logged. */
  averageMinutes: number;
  /** Consecutive days ending today on which a session was logged. */
  streakDays: number;
  /** Distinct days with at least one session. */
  activeDays: number;
  /** Sessions per type, busiest first. Types with none are omitted. */
  byType: { type: WorkoutLog['type']; label: string; sessions: number; minutes: number }[];
}

export const EMPTY_WORKOUT_TOTALS: WorkoutTotals = {
  sessions: 0,
  minutes: 0,
  caloriesBurned: 0,
};

/** "45m" / "1h" / "1h 15m" — how the app labels a duration throughout. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function toWorkoutLogView(
  log: WorkoutLog,
  timeZone: string,
  today: string,
): WorkoutLogView {
  const label = dayLabel(log.performedOn, today);
  const time = toLocalTimeLabel(log.performedAt, timeZone);
  const duration = durationLabel(log.durationMinutes);

  return {
    id: log.id,
    type: log.type,
    typeLabel: workoutTypeLabel(log.type),
    name: log.name,
    durationMinutes: log.durationMinutes,
    durationLabel: duration,
    caloriesBurned: log.caloriesBurned,
    intensity: log.intensity,
    icon: log.icon,
    accent: log.accent,
    time,
    performedAt: log.performedAt.toISOString(),
    date: log.performedOn,
    dayLabel: label,
    subtitle: `${label} · ${time} · ${duration}`,
    notes: log.notes,
  };
}

/** Sums a set of views. Kept in one place so every surface totals identically. */
export function sumWorkoutTotals(workouts: readonly WorkoutLogView[]): WorkoutTotals {
  return workouts.reduce<WorkoutTotals>(
    (acc, workout) => ({
      sessions: acc.sessions + 1,
      minutes: acc.minutes + workout.durationMinutes,
      caloriesBurned: acc.caloriesBurned + workout.caloriesBurned,
    }),
    { ...EMPTY_WORKOUT_TOTALS },
  );
}
