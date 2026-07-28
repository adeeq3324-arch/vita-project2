import { IsIn, IsOptional } from 'class-validator';

/** The list's three segments, matching the Reminders screen's filter. */
export const REMINDER_FILTERS = ['all', 'today', 'upcoming'] as const;

export type ReminderFilter = (typeof REMINDER_FILTERS)[number];

/**
 * Filters the reminder list.
 *
 * `today` is everything whose next firing falls on the user's current calendar day
 * — including ones already delivered this morning, which is what the screen shows.
 * `upcoming` is everything after that. Disabled reminders appear in both `all` and,
 * where their rule would have placed them, the other two: the switch controls
 * delivery, not visibility.
 */
export class ReminderListQueryDto {
  @IsOptional()
  @IsIn(REMINDER_FILTERS, { message: 'filter must be all, today or upcoming.' })
  filter?: ReminderFilter;
}
