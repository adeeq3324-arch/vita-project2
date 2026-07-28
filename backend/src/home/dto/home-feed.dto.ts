import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';

export const MAX_TREND_DAYS = 30;
export const DEFAULT_TREND_DAYS = 7;

/**
 * Selects which day the Home tab is showing. The week strip lets the user pick
 * any day, so the whole feed is date-parameterised rather than fixed to today.
 */
export class HomeFeedQueryDto {
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  /** Length of the health-score trend series ending on `date`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(MAX_TREND_DAYS)
  trendDays?: number;
}
