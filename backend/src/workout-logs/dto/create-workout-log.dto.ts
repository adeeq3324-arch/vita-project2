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

const WORKOUT_TYPES = workoutTypeEnum.enumValues;
const INTENSITIES = workoutIntensityEnum.enumValues;
const ACCENTS = accentColorEnum.enumValues;

/** A single session cannot sensibly run longer than this, minutes. */
export const MAX_DURATION_MINUTES = 1440;

/**
 * Logs one completed training session.
 *
 * Only `type` and `durationMinutes` are required: those are the two things the
 * user always knows, and everything else has a defensible default — the type's
 * own label and icon, moderate intensity, and an energy estimate derived from the
 * profile. A wearable that knows better simply sends `caloriesBurned` too.
 */
export class CreateWorkoutLogDto {
  @IsIn(WORKOUT_TYPES, { message: 'type must be a supported workout type.' })
  type!: (typeof WORKOUT_TYPES)[number];

  @Type(() => Number)
  @IsInt({ message: 'durationMinutes must be a whole number of minutes.' })
  @Min(1)
  @Max(MAX_DURATION_MINUTES)
  durationMinutes!: number;

  /** What the user called the session. Defaults to the workout type's label. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(INTENSITIES, { message: 'intensity must be low, moderate or high.' })
  intensity?: (typeof INTENSITIES)[number];

  /** Energy burned, kcal. Estimated from type, intensity, duration and weight when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'caloriesBurned must be a whole number of kcal.' })
  @Min(0)
  @Max(20000)
  caloriesBurned?: number;

  /** When the session took place. Defaults to now. */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'performedAt must be an ISO-8601 timestamp.' })
  performedAt?: string;

  /**
   * The training day to file this under. Defaults to the calendar day
   * `performedAt` falls on in the user's time zone — override only to log a
   * session against a past day.
   */
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  /** Presentation overrides; the workout type's own values are used by default. */
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
