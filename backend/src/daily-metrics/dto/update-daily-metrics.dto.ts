import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min, NotEquals } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';

/**
 * Upserts the day's metrics. Every field is optional; only those supplied are
 * written, so the client can push steps from a health-kit sync without touching
 * the weigh-in the user entered by hand.
 */
export class UpdateDailyMetricsDto {
  /** Day to write to. Defaults to today in the user's time zone. */
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'steps must be a whole number.' })
  @Min(0)
  @Max(200000)
  steps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'waterMl must be a whole number of millilitres.' })
  @Min(0)
  @Max(20000)
  waterMl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'activeCalories must be a whole number of kcal.' })
  @Min(0)
  @Max(20000)
  activeCalories?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'weightKg must be a number (kg).' })
  @Min(20)
  @Max(500)
  weightKg?: number;

  @IsOptional()
  @IsBoolean()
  workoutCompleted?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'workoutMinutes must be a whole number of minutes.' })
  @Min(0)
  @Max(1440)
  workoutMinutes?: number;
}

/**
 * Adds to (or, with a negative amount, corrects) the day's fluid intake.
 * Incrementing server-side keeps concurrent taps on the water card — phone and
 * watch at once — from overwriting each other, which a plain "set to N" would.
 */
export class AddWaterDto {
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  @Type(() => Number)
  @IsInt({ message: 'amountMl must be a whole number of millilitres.' })
  @Min(-5000)
  @Max(5000)
  @NotEquals(0, { message: 'amountMl must not be zero.' })
  amountMl!: number;
}
