import { api } from '@/services/api/client';

/**
 * Reminders service.
 *
 * Reminders fire from the server on a schedule, so they have to live there:
 * one held in app state would stop existing the moment the app was closed —
 * which is the only time a reminder is worth anything.
 */

export const REMINDER_CATEGORIES = [
  'meal',
  'water',
  'workout',
  'supplement',
  'weighIn',
  'sleep',
  'custom',
] as const;

export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number];

export type ReminderFilter = 'all' | 'today' | 'upcoming';

export interface Reminder {
  id: string;
  name: string;
  category: ReminderCategory;
  /** Notification body — the custom message, or the category's default. */
  message: string;
  /** Local wall-clock time, `HH:MM` (24-hour) — the value a form edits. */
  time: string;
  /** The same time as displayed: "8:00 AM". */
  timeLabel: string;
  /** ISO weekdays it repeats on (1 = Monday); empty means every day. */
  daysOfWeek: number[];
  /** "Every day" / "Weekdays" / "Mon, Wed, Fri". */
  repeat: string;
  enabled: boolean;
  /** MaterialCommunityIcons glyph name; resolve with `materialIcon()`. */
  icon: string;
  /** Design-system accent key; resolve with `accentName()`. */
  accent: string;
  /** Which segment of the list it belongs in. */
  when: 'today' | 'upcoming';
  nextRunAt: string;
  lastSentAt: string | null;
}

export interface CreateReminderInput {
  name: string;
  /** 24-hour `HH:MM`. */
  time: string;
  category?: ReminderCategory;
  message?: string;
  /** ISO weekdays (1 = Monday). Omit for every day. */
  daysOfWeek?: number[];
  enabled?: boolean;
}

export type UpdateReminderInput = Partial<CreateReminderInput>;

export async function list(filter: ReminderFilter = 'all'): Promise<Reminder[]> {
  return api.get<Reminder[]>(`/api/v1/reminders?filter=${filter}`);
}

export async function create(input: CreateReminderInput): Promise<Reminder> {
  return api.post<Reminder>('/api/v1/reminders', input);
}

export async function update(id: string, patch: UpdateReminderInput): Promise<Reminder> {
  return api.patch<Reminder>(`/api/v1/reminders/${id}`, patch);
}

export async function remove(id: string): Promise<void> {
  await api.delete<void>(`/api/v1/reminders/${id}`);
}

/** Human labels for the category chips, in the order the sheet shows them. */
export const CATEGORY_LABELS: Record<ReminderCategory, string> = {
  meal: 'Meal',
  water: 'Water',
  workout: 'Workout',
  supplement: 'Supplement',
  weighIn: 'Weigh-in',
  sleep: 'Sleep',
  custom: 'Other',
};

/**
 * Parses what a person actually types into the 24-hour `HH:MM` the API takes:
 * "7:30 PM", "7.30pm", "19:30", "7 pm". Returns null when it cannot be read as
 * a time, so the sheet can say so instead of sending something the server will
 * reject.
 */
export function parseTimeInput(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const match = /^(\d{1,2})[:.\s]?(\d{2})?\s*(am|pm)?$/.exec(text);
  if (!match) return null;

  let hours = Number.parseInt(match[1]!, 10);
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
