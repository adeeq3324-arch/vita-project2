import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';

/** Upper bounds, so no single request can pull an unbounded slice of history. */
export const MAX_RECENT_LIMIT = 50;
export const DEFAULT_RECENT_LIMIT = 10;
export const MAX_HISTORY_DAYS = 90;
export const DEFAULT_HISTORY_DAYS = 7;

/** Selects a single diary day. Defaults to today in the user's time zone. */
export class DayQueryDto {
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}

/**
 * "Recent Meals" — the most recently logged entries, newest first, used as
 * quick-add suggestions on the Add Meal screen.
 */
export class RecentMealLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RECENT_LIMIT)
  limit?: number;
}

/**
 * "Meal History" — per-day roll-ups over a window. Either give an explicit
 * `from`/`to` range, or just `days` to get that many days ending today.
 */
export class MealHistoryQueryDto {
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @IsOptional()
  @IsCalendarDate()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_HISTORY_DAYS)
  days?: number;
}
