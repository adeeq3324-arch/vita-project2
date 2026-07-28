import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TIME_OF_DAY_PATTERN } from '../../common/util/date.util';
import { accentColorEnum, reminderCategoryEnum } from '../../database/schema';

const CATEGORIES = reminderCategoryEnum.enumValues;
const ACCENTS = accentColorEnum.enumValues;

/**
 * Partial update of a reminder. Only the supplied fields change.
 *
 * This is also the toggle: the list's switch sends `{ "enabled": false }` and
 * nothing else. Changing the time, the days, or switching it back on all recompute
 * the next firing from now, so a reminder can never be left pointing at an instant
 * its own rule no longer implies.
 */
export class UpdateReminderDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'time must be a 24-hour HH:MM value.' })
  time?: string;

  @IsOptional()
  @IsIn(CATEGORIES, { message: 'category must be a supported reminder category.' })
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(240)
  message?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true, message: 'daysOfWeek entries must be whole numbers.' })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @IsOptional()
  @IsIn(ACCENTS, { message: 'accent must be a valid accent colour.' })
  accent?: (typeof ACCENTS)[number];
}
