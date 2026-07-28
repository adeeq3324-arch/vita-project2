import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';
import {
  accentColorEnum,
  workoutIntensityEnum,
  workoutTypeEnum,
} from '../../database/schema';
import { MAX_DURATION_MINUTES } from './create-workout-log.dto';

const WORKOUT_TYPES = workoutTypeEnum.enumValues;
const INTENSITIES = workoutIntensityEnum.enumValues;
const ACCENTS = accentColorEnum.enumValues;

/**
 * Partial update of a logged session. Only the supplied fields change.
 *
 * Changing the type, intensity or duration re-estimates the energy burned, since
 * a stale estimate is worse than no estimate — unless `caloriesBurned` is sent in
 * the same request, which is always taken as authoritative.
 */
export class UpdateWorkoutLogDto {
  @IsOptional()
  @IsIn(WORKOUT_TYPES, { message: 'type must be a supported workout type.' })
  type?: (typeof WORKOUT_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'durationMinutes must be a whole number of minutes.' })
  @Min(1)
  @Max(MAX_DURATION_MINUTES)
  durationMinutes?: number;

  @IsOptional()
  @IsIn(INTENSITIES, { message: 'intensity must be low, moderate or high.' })
  intensity?: (typeof INTENSITIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'caloriesBurned must be a whole number of kcal.' })
  @Min(0)
  @Max(20000)
  caloriesBurned?: number;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'performedAt must be an ISO-8601 timestamp.' })
  performedAt?: string;

  @IsOptional()
  @IsCalendarDate()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @IsOptional()
  @IsIn(ACCENTS, { message: 'accent must be a valid accent colour.' })
  accent?: (typeof ACCENTS)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
