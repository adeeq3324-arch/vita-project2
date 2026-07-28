import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';
import { workoutTypeEnum } from '../../database/schema';

/** Upper bounds, so no single request can pull an unbounded slice of history. */
export const MAX_RECENT_LIMIT = 50;
export const DEFAULT_RECENT_LIMIT = 10;
export const MAX_HISTORY_DAYS = 365;
export const DEFAULT_HISTORY_DAYS = 7;

const WORKOUT_TYPES = workoutTypeEnum.enumValues;

/** Selects a single training day. Defaults to today in the user's time zone. */
export class WorkoutDayQueryDto {
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}

/** The most recently completed sessions, newest first. */
export class RecentWorkoutsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RECENT_LIMIT)
  limit?: number;

  /** Narrows to one kind of training, for a "your running history" view. */
  @IsOptional()
  @IsIn(WORKOUT_TYPES, { message: 'type must be a supported workout type.' })
  type?: (typeof WORKOUT_TYPES)[number];
}

/**
 * Per-day roll-ups over a window. Either give an explicit `from`/`to` range, or
 * just `days` to get that many days ending today.
 */
export class WorkoutHistoryQueryDto {
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
