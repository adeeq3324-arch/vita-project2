import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { accentColorEnum, mealTypeEnum } from '../../database/schema';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';

const MEAL_TYPES = mealTypeEnum.enumValues;
const ACCENTS = accentColorEnum.enumValues;

/** True when the entry is not backed by a catalogue food. */
const isCustomEntry = (dto: CreateMealLogDto): boolean => !dto.foodId;

/**
 * Logs one item to the food diary. Two shapes are accepted, matching the two
 * ways the app creates entries:
 *
 *  - **From the catalogue** — send `foodId` (and optionally `servings`). Name,
 *    macros and presentation are taken from the food and scaled by the portion,
 *    so the client cannot submit nutrition that disagrees with the catalogue.
 *  - **Custom** — omit `foodId` and send `name` + `kcal` + macros directly, as
 *    the "Add Custom Meal" sheet does.
 *
 * The conditional validators below enforce exactly that: the custom fields are
 * required if, and only if, no `foodId` was supplied.
 */
export class CreateMealLogDto {
  /** Catalogue entry to log. Omit for a custom entry. */
  @IsOptional()
  @IsUUID(4, { message: 'foodId must be a valid food id.' })
  foodId?: string;

  /** Portion multiplier applied to the catalogue serving. Defaults to 1. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'servings must be a number.' })
  @Min(0.01)
  @Max(100)
  servings?: number;

  @ValidateIf(isCustomEntry)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @ValidateIf(isCustomEntry)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'kcal must be a number.' })
  @Min(0)
  @Max(20000)
  kcal?: number;

  @ValidateIf(isCustomEntry)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'protein must be a number (g).' })
  @Min(0)
  @Max(2000)
  protein?: number;

  @ValidateIf(isCustomEntry)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'carbs must be a number (g).' })
  @Min(0)
  @Max(2000)
  carbs?: number;

  @ValidateIf(isCustomEntry)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'fat must be a number (g).' })
  @Min(0)
  @Max(2000)
  fat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'fiber must be a number (g).' })
  @Min(0)
  @Max(2000)
  fiber?: number;

  /** Sitting this belongs to. Inferred from the time of day when omitted. */
  @IsOptional()
  @IsIn(MEAL_TYPES, { message: 'mealType must be breakfast, lunch, dinner or snack.' })
  mealType?: (typeof MEAL_TYPES)[number];

  /** When it was eaten. Defaults to now. */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'loggedAt must be an ISO-8601 timestamp.' })
  loggedAt?: string;

  /**
   * The diary day to file this under. Defaults to the calendar day `loggedAt`
   * falls on in the user's time zone — override only to log against a past day.
   */
  @IsOptional()
  @IsCalendarDate()
  date?: string;

  /** Presentation overrides; the catalogue food's own values are used by default. */
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
