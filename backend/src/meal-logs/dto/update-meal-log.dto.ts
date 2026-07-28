import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { accentColorEnum, mealTypeEnum } from '../../database/schema';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.validator';

const MEAL_TYPES = mealTypeEnum.enumValues;
const ACCENTS = accentColorEnum.enumValues;

/**
 * Partial update of a diary entry. Only the supplied fields change.
 *
 * Changing `servings` on an entry that came from the catalogue re-scales its
 * nutrition from the source food automatically — the common "I actually had two
 * of those" correction needs nothing else. Explicit macro values always win over
 * that re-scaling, which is what lets a user fine-tune an entry by hand.
 */
export class UpdateMealLogDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'servings must be a number.' })
  @Min(0.01)
  @Max(100)
  servings?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'kcal must be a number.' })
  @Min(0)
  @Max(20000)
  kcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'protein must be a number (g).' })
  @Min(0)
  @Max(2000)
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'carbs must be a number (g).' })
  @Min(0)
  @Max(2000)
  carbs?: number;

  @IsOptional()
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

  @IsOptional()
  @IsIn(MEAL_TYPES, { message: 'mealType must be breakfast, lunch, dinner or snack.' })
  mealType?: (typeof MEAL_TYPES)[number];

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'loggedAt must be an ISO-8601 timestamp.' })
  loggedAt?: string;

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
