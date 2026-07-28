import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { foodCategoryEnum } from '../../database/schema';

const CATEGORIES = foodCategoryEnum.enumValues;

/** Hard ceiling on page size, so no caller can ask for the whole catalogue. */
export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Query parameters for the "Add Meal" search bar. Every field is optional: with
 * no query at all the endpoint returns the catalogue A–Z, which is what the
 * search screen shows before the user types.
 */
export class SearchFoodsDto {
  /** Free-text search over name and brand. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(CATEGORIES, { message: 'category must be a valid food category.' })
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
