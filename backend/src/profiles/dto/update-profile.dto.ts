import { Transform, Type } from 'class-transformer';
import {
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
import { activityLevelEnum, genderEnum, unitSystemEnum } from '../../database/schema';
import { IsTimeZone } from '../../common/validation/is-time-zone.validator';

const GENDERS = genderEnum.enumValues;
const ACTIVITY_LEVELS = activityLevelEnum.enumValues;
const UNIT_SYSTEMS = unitSystemEnum.enumValues;

/**
 * Partial profile update. Every field is optional; only those supplied are
 * changed. Field names mirror the onboarding/profile contract used by the
 * client (`username`, `height` in cm, `weight` in kg).
 */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(50)
  @Max(300)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(500)
  weight?: number;

  @IsOptional()
  @IsIn(ACTIVITY_LEVELS)
  activityLevel?: (typeof ACTIVITY_LEVELS)[number];

  @IsOptional()
  @IsIn(UNIT_SYSTEMS)
  unitSystem?: (typeof UNIT_SYSTEMS)[number];

  /**
   * IANA time zone the client is in. Sent by the app on first launch and
   * whenever the device zone changes, so diary days and daily metrics align
   * with the user's own midnight.
   */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
