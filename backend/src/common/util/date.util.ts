/**
 * Time-zone-aware calendar-day helpers.
 *
 * Every day-scoped feature (food diary, daily metrics, home feed) has to agree
 * on where one day ends and the next begins. That boundary belongs to the
 * *user*, not the server, so all of these helpers take an IANA time zone and
 * work in terms of `YYYY-MM-DD` local date strings — the same representation
 * the `date` columns use, which keeps comparisons exact and free of any
 * UTC-offset drift.
 */

/** Strict `YYYY-MM-DD` shape. Calendar validity is checked separately. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Fallback zone when a profile has none (or an unrecognised one). */
export const DEFAULT_TIME_ZONE = 'UTC';

const MS_PER_DAY = 86_400_000;

/** True when `value` is a time zone this Node build can actually resolve. */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Falls back to UTC for missing or unusable zones, so formatting never throws. */
export function resolveTimeZone(value: string | null | undefined): string {
  return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

/** True when `value` is a well-formed *and* real calendar date (rejects 2025-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * The calendar date `instant` falls on in `timeZone`, as `YYYY-MM-DD`.
 * `en-CA` is used because its short date format *is* ISO-8601.
 */
export function toLocalDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Today's calendar date in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return toLocalDate(now, timeZone);
}

/**
 * Clock time of `instant` in `timeZone`, formatted the way the diary renders it
 * ("12:30 PM").
 */
export function toLocalTimeLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(instant);
}

/**
 * Hour of the day (0–23) that `instant` falls on in `timeZone`. `h23` is
 * requested explicitly because the default `en-US` cycle renders midnight as
 * "24", which would break any range check built on the result.
 */
export function localHour(instant: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return Number.parseInt(hour, 10);
}

/** `date` shifted by whole days, staying in `YYYY-MM-DD` form. */
export function addDays(date: string, days: number): string {
  const shifted = new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days between two calendar dates (`to - from`). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * The Monday on or before `date`, as `YYYY-MM-DD`.
 *
 * Weekly features key their rows on this so "the current week" is one canonical
 * value rather than whichever day the user happened to open the app on.
 */
export function startOfWeek(date: string): string {
  const instant = new Date(`${date}T00:00:00Z`);
  // getUTCDay() is 0 for Sunday; shift so Monday is the start of the week.
  const offset = (instant.getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

/** The first day of the month `date` falls in, as `YYYY-MM-DD`. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** ISO-8601 weekday of `date`: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** The last day of the month `date` falls in, as `YYYY-MM-DD`. */
export function endOfMonth(date: string): string {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

/** `date` shifted by whole months, clamped to the end of a shorter target month. */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  // Day 0 of the following month is the last day of the target month.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Strict `HH:MM` or `HH:MM:SS` shape, 24-hour. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Normalises a `HH:MM` / `HH:MM:SS` string to the `HH:MM:SS` a `time` column stores. */
export function normalizeTimeOfDay(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/**
 * Renders a stored `HH:MM:SS` as the app displays it ("8:00 AM").
 *
 * Formatted from a fixed UTC instant rather than a real one: the value is a bare
 * wall-clock time with no date and no zone attached, so introducing either would
 * only give a daylight-saving rule something to shift.
 */
export function timeOfDayLabel(timeOfDay: string): string {
  const [hour, minute] = timeOfDay.split(':').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

/**
 * The wall-clock `HH:MM` an instant reads as in `timeZone`.
 *
 * The complement of {@link zonedTimeToUtc}: given a scheduled instant it recovers
 * the local time it was scheduled *for*, which is how a stored schedule can be
 * checked against the zone it was computed in.
 */
export function toLocalTimeOfDay(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

/**
 * The offset of `timeZone` at `instant`, in milliseconds east of UTC.
 *
 * Derived by formatting the instant in the zone and reading the result back as
 * though it were UTC: the difference between the two *is* the offset. Doing it
 * this way means the ICU database answers the question, so historical and future
 * daylight-saving rules are handled correctly without a table of our own.
 */
export function zonedOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );

  // Sub-second precision is discarded by the formatter; put it back so the offset
  // is a whole-minute value rather than one skewed by the instant's milliseconds.
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/**
 * The UTC instant at which the wall clock in `timeZone` reads `date` + `timeOfDay`.
 *
 * The offset needed to answer depends on the answer itself — instants either side of
 * a daylight-saving change have different ones — so two candidates are generated by
 * substituting the offset twice, and each is then *verified* by converting it back
 * and checking it really does read as the requested wall-clock time.
 *
 * Verification is what makes the two awkward cases well defined rather than
 * accidental:
 *
 *  - **Ambiguous** times (the hour repeated when clocks go back) have two valid
 *    instants. Exactly one is returned — whichever the offset probe converges on,
 *    which in practice is the post-transition one — so the reminder fires once, on
 *    the requested date, at a moment the clock genuinely reads the requested time.
 *    The two are an hour apart and both read the same on the user's clock, so the
 *    choice between them is not observable.
 *  - **Skipped** times (02:30 on a spring-forward morning never happens) have none.
 *    The later candidate is returned, which sits just after the jump — the reminder
 *    shifts forward by the gap and still fires exactly once that day, rather than
 *    silently landing an hour *before* the time it was set for.
 */
export function zonedTimeToUtc(date: string, timeOfDay: string, timeZone: string): Date {
  // The requested wall clock, expressed as though it were UTC. An instant matches it
  // when adding that instant's local offset lands back on this value.
  const target = Date.parse(`${date}T${normalizeTimeOfDay(timeOfDay)}Z`);

  const first = target - zonedOffsetMs(new Date(target), timeZone);
  const second = target - zonedOffsetMs(new Date(first), timeZone);

  const candidates = first === second ? [first] : [first, second];
  const valid = candidates.filter(
    (candidate) => candidate + zonedOffsetMs(new Date(candidate), timeZone) === target,
  );

  return new Date(valid.length > 0 ? Math.min(...valid) : Math.max(...candidates));
}

/** Every date from `from` to `to`, inclusive, ascending. */
export function eachDateInRange(from: string, to: string): string[] {
  const span = daysBetween(from, to);
  if (span < 0) {
    return [];
  }
  return Array.from({ length: span + 1 }, (_, offset) => addDays(from, offset));
}

/**
 * How the diary labels a day relative to today: "Today", "Yesterday", the
 * weekday name within the past week, then an absolute date ("12 Mar").
 */
export function dayLabel(date: string, today: string): string {
  const delta = daysBetween(date, today);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta === -1) return 'Tomorrow';

  const instant = new Date(`${date}T12:00:00Z`);
  if (delta > 1 && delta < 7) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(instant);
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(
    instant,
  );
}
