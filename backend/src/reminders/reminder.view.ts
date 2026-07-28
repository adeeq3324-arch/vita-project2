import { timeOfDayLabel, toLocalDate } from '../common/util/date.util';
import type { Reminder } from '../database/schema';
import { repeatLabel } from './reminder.schedule';

/**
 * A reminder as the Reminders screen renders it.
 *
 * Mirrors the row the screen draws — a time, a name, an icon tile and a switch —
 * plus the `when` bucket its segmented filter uses. The screen's local field is
 * called `on`; the API calls it `enabled`, which is the name the column, the DTO and
 * the switch's semantics all share.
 *
 * Both representations of the time are returned: `time` is the machine value a form
 * edits, `timeLabel` is the "8:00 AM" the row displays. The client never has to
 * parse or format one into the other.
 */
export interface ReminderView {
  id: string;
  name: string;
  category: Reminder['category'];
  /** Notification body — the custom message, or the category's default. */
  message: string;

  /** Local wall-clock time, `HH:MM` (24-hour). */
  time: string;
  /** The same time as displayed: "8:00 AM". */
  timeLabel: string;
  /** ISO weekdays it repeats on; empty means every day. */
  daysOfWeek: number[];
  /** "Every day" / "Weekdays" / "Mon, Wed, Fri". */
  repeat: string;

  enabled: boolean;
  icon: string;
  accent: Reminder['accent'];

  /** Which segment of the list it belongs in. */
  when: 'today' | 'upcoming';
  /** Next firing, ISO-8601. */
  nextRunAt: string;
  /** Last firing, ISO-8601; null until it first fires. */
  lastSentAt: string | null;
}

export function toReminderView(
  reminder: Reminder,
  timeZone: string,
  today: string,
  message: string,
): ReminderView {
  // `time` columns come back as `HH:MM:SS`; the wire format is minute-granular.
  const time = reminder.timeOfDay.slice(0, 5);

  return {
    id: reminder.id,
    name: reminder.name,
    category: reminder.category,
    message,
    time,
    timeLabel: timeOfDayLabel(reminder.timeOfDay),
    daysOfWeek: [...reminder.daysOfWeek],
    repeat: repeatLabel(reminder.daysOfWeek),
    enabled: reminder.enabled,
    icon: reminder.icon,
    accent: reminder.accent,
    when: toLocalDate(reminder.nextRunAt, timeZone) === today ? 'today' : 'upcoming',
    nextRunAt: reminder.nextRunAt.toISOString(),
    lastSentAt: reminder.lastSentAt?.toISOString() ?? null,
  };
}
