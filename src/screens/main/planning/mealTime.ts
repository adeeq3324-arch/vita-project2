/**
 * Clock times on the planning screens.
 *
 * The API stores and sends 24-hour "HH:MM" because that is unambiguous to
 * store; the app writes 12-hour "7:30 AM" because that is what the rest of it
 * writes. One function does the translation so a planned meal, a supplement and
 * a reminder never disagree about how a time looks.
 */

/**
 * "07:30" as the app writes times: "7:30 AM".
 *
 * Formatted in UTC against an arbitrary date, which sounds wrong and is exactly
 * right: the value is a wall-clock time, not an instant. Building a local
 * `Date` from it would drag the device's own offset into a number that is
 * supposed to mean "half seven wherever you are".
 *
 * Anything that is not a readable time comes back untouched rather than as
 * "Invalid Date" — a plan generated before meals were timed should show nothing
 * at all, and the callers all treat an empty string as "no time".
 */
export function formatClockTime(time: string | null | undefined): string {
  if (!time) return '';

  const parts = time.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (parts.length !== 2 || !Number.isInteger(hours) || !Number.isInteger(minutes)) return time;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return time;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}
