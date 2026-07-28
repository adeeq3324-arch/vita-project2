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
 * Creates a reminder.
 *
 * Only a name and a time are required — that is exactly what the "Add Reminder"
 * sheet asks for. Everything else has a defensible default: `custom` category,
 * every day, enabled, and the category's own icon and accent.
 *
 * `time` is a 24-hour local wall-clock value. The API takes `HH:MM` rather than the
 * "7:30 PM" the sheet displays because an unambiguous machine format belongs on the
 * wire; the response carries the formatted label back for display.
 */
export class CreateReminderDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name!: string;

  /** Local wall-clock time, `HH:MM` (24-hour). Seconds are accepted and ignored. */
  @Matches(TIME_OF_DAY_PATTERN, { message: 'time must be a 24-hour HH:MM value.' })
  time!: string;

  @IsOptional()
  @IsIn(CATEGORIES, { message: 'category must be a supported reminder category.' })
  category?: (typeof CATEGORIES)[number];

  /** Notification body. Defaults to the category's own wording. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(240)
  message?: string;

  /**
   * ISO weekdays to repeat on (1 = Monday … 7 = Sunday). Omit, or send an empty
   * array, for every day.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true, message: 'daysOfWeek entries must be whole numbers.' })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];

  /** Whether it starts switched on. Defaults to true. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Presentation overrides; the category's own values are used by default. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @IsOptional()
  @IsIn(ACCENTS, { message: 'accent must be a valid accent colour.' })
  accent?: (typeof ACCENTS)[number];
}
