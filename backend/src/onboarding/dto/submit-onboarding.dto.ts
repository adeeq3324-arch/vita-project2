import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  activityLevelEnum,
  genderEnum,
  healthConditionEnum,
  primaryGoalEnum,
  unitSystemEnum,
} from '../../database/schema';
import { IsTimeZone } from '../../common/validation/is-time-zone.validator';

/** Enum value sources — single source of truth shared with the DB schema. */
const GENDERS = genderEnum.enumValues;
const ACTIVITY_LEVELS = activityLevelEnum.enumValues;
const PRIMARY_GOALS = primaryGoalEnum.enumValues;
const UNIT_SYSTEMS = unitSystemEnum.enumValues;
/** The client also sends the UI-only `none` sentinel, accepted then dropped. */
const CONDITION_VALUES = [...healthConditionEnum.enumValues, 'none'] as const;

/**
 * Single-call onboarding payload. Field names and types mirror the frontend's
 * `OnboardingData` shape exactly (see `src/context/OnboardingContext.tsx`):
 * `age`, `height`, `weight` and `targetWeight` arrive as numeric strings and
 * are coerced to numbers here; `height`/`weight` are centimetres/kilograms.
 */
export class SubmitOnboardingDto {
  @IsIn(PRIMARY_GOALS, { message: 'goal must be a valid primary goal.' })
  goal!: (typeof PRIMARY_GOALS)[number];

  // Accepts the client's list as-is; the service strips the UI-only `none`
  // sentinel and de-duplicates before persisting.
  @IsArray()
  @IsIn(CONDITION_VALUES, { each: true, message: 'conditions contains an unknown value.' })
  conditions!: (typeof CONDITION_VALUES)[number][];

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'username is required.' })
  @MaxLength(50)
  username!: string;

  @Type(() => Number)
  @IsInt({ message: 'age must be a whole number.' })
  @Min(1)
  @Max(120)
  age!: number;

  @IsIn(GENDERS, { message: 'gender must be a valid option.' })
  gender!: (typeof GENDERS)[number];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'height must be a number (cm).' })
  @Min(50)
  @Max(300)
  height!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'weight must be a number (kg).' })
  @Min(20)
  @Max(500)
  weight!: number;

  @IsIn(ACTIVITY_LEVELS, { message: 'activityLevel must be a valid option.' })
  activityLevel!: (typeof ACTIVITY_LEVELS)[number];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetWeight must be a number (kg).' })
  @Min(20)
  @Max(500)
  targetWeight!: number;

  /** Optional display-unit preference; the client omits it and we default to metric. */
  @IsOptional()
  @IsIn(UNIT_SYSTEMS)
  unitSystem?: (typeof UNIT_SYSTEMS)[number];

  /**
   * Optional device time zone. Sending it at onboarding means the very first
   * diary day and daily-metrics row already land on the user's own calendar
   * day; omitted, the profile defaults to UTC until the client updates it.
   */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
