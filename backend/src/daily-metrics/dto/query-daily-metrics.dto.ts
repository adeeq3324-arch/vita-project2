import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';

export const MAX_RANGE_DAYS = 90;
export const DEFAULT_RANGE_DAYS = 7;

/** Selects a single day. Defaults to today in the user's time zone. */
export class DailyMetricsDayQueryDto {
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}

/**
 * Selects a window of days for trend charts. Either an explicit `from`/`to`
 * range, or `days` for that many days ending today.
 */
export class DailyMetricsRangeQueryDto {
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
  @Max(MAX_RANGE_DAYS)
  days?: number;
}
