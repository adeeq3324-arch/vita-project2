import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';
import { snapshotPeriodEnum } from '../../database/schema';

const PERIODS = snapshotPeriodEnum.enumValues;

/**
 * Rolls up a calendar period and, optionally, records the body measurements that
 * belong to it.
 *
 * Everything except the measurements is computed server-side from the diaries, so
 * the client cannot submit figures that disagree with what was logged. The
 * measurements *are* client-supplied because nothing else can know them — a tape
 * measure and a body-composition scale are outside the app.
 *
 * Idempotent: submitting the same period twice recomputes it in place. Fields left
 * out are left as they were, so a user can add a body-fat reading in the morning and
 * a waist measurement in the evening without the second erasing the first.
 */
export class RecordSnapshotDto {
  /** Which period to roll up. Defaults to `week`. */
  @IsOptional()
  @IsIn(PERIODS, { message: 'period must be week or month.' })
  period?: (typeof PERIODS)[number];

  /**
   * Any day inside the period to roll up; the period boundaries are derived from
   * it. Defaults to today, i.e. the period in progress.
   */
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'bodyFatPercent must be a number (%).' })
  @Min(1)
  @Max(70)
  bodyFatPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'muscleMassPercent must be a number (%).' })
  @Min(10)
  @Max(90)
  muscleMassPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'waistCm must be a number (cm).' })
  @Min(30)
  @Max(250)
  waistCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'chestCm must be a number (cm).' })
  @Min(30)
  @Max(250)
  chestCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'hipsCm must be a number (cm).' })
  @Min(30)
  @Max(250)
  hipsCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'armCm must be a number (cm).' })
  @Min(10)
  @Max(100)
  armCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'thighCm must be a number (cm).' })
  @Min(20)
  @Max(150)
  thighCm?: number;
}
