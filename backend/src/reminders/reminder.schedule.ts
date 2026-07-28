import {
  addDays,
  isoWeekday,
  normalizeTimeOfDay,
  toLocalDate,
  zonedTimeToUtc,
} from '../common/util/date.util';

/**
 * How many days ahead a next firing is searched for.
 *
 * Eight rather than seven: a reminder set for a single weekday, on that weekday,
 * after its time has passed, needs the *following* week — which is seven days
 * beyond today, so the search has to include day seven.
 */
const SEARCH_DAYS = 8;

/** A reminder's repeat rule, independent of any stored row. */
export interface ReminderSchedule {
  /** Local wall-clock time, `HH:MM` or `HH:MM:SS`. */
  timeOfDay: string;
  /** ISO weekdays it repeats on (1 = Monday … 7 = Sunday). Empty means daily. */
  daysOfWeek: readonly number[];
  /** IANA zone the wall-clock time belongs to. */
  timeZone: string;
}

/**
 * The next instant a schedule fires, strictly after `after`.
 *
 * Resolved by walking forward through local calendar days and converting each
 * candidate's wall-clock time to UTC, rather than by adding fixed offsets to a
 * timestamp. That distinction is the whole point: a reminder set for 08:00 must fire
 * at 08:00 local across a daylight-saving change, which an interval of exactly
 * 24 hours would not do.
 *
 * Deliberately never returns a *missed* firing. If the process was down when one was
 * due, the schedule advances past it — a nudge to drink water two hours ago is worse
 * than no nudge, and a backlog of them arriving at once is worse still.
 */
export function nextRunAt(schedule: ReminderSchedule, after: Date = new Date()): Date {
  const timeOfDay = normalizeTimeOfDay(schedule.timeOfDay);
  const startDate = toLocalDate(after, schedule.timeZone);

  for (let offset = 0; offset <= SEARCH_DAYS; offset += 1) {
    const date = addDays(startDate, offset);

    if (!firesOn(schedule.daysOfWeek, date)) {
      continue;
    }

    const candidate = zonedTimeToUtc(date, timeOfDay, schedule.timeZone);
    if (candidate.getTime() > after.getTime()) {
      return candidate;
    }
  }

  // Unreachable for any schedule that has at least one day: the loop spans a full
  // week plus one. Throwing rather than returning a wrong instant means a schedule
  // that somehow has no valid day surfaces as an error instead of a reminder that
  // silently never fires.
  throw new Error('The reminder schedule has no day on which it would ever fire.');
}

/** True when a reminder repeating on `daysOfWeek` fires on `date`. */
export function firesOn(daysOfWeek: readonly number[], date: string): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(isoWeekday(date));
}

/**
 * A human label for the repeat rule: "Every day", "Weekdays", "Mon, Wed, Fri".
 *
 * Built here rather than in the client so the list rows and any future
 * notification-settings screen describe the same rule the same way.
 */
export function repeatLabel(daysOfWeek: readonly number[]): string {
  if (daysOfWeek.length === 0 || daysOfWeek.length === 7) {
    return 'Every day';
  }

  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  if (sorted.join() === '1,2,3,4,5') {
    return 'Weekdays';
  }
  if (sorted.join() === '6,7') {
    return 'Weekends';
  }
  return sorted.map((day) => WEEKDAY_NAMES[day - 1]).join(', ');
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
