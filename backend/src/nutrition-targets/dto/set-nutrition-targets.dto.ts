import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Explicit, user-chosen daily targets. Any field left out keeps the value the
 * derivation produced, so a user can override just their protein goal without
 * having to restate the rest.
 *
 * Submitting this switches the targets to `custom`, which stops them from being
 * recomputed when the profile changes. `POST /nutrition/targets/recalculate`
 * hands control back to the derivation.
 */
export class SetNutritionTargetsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'calories must be a whole number of kcal.' })
  @Min(800)
  @Max(10000)
  calories?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'protein must be a whole number of grams.' })
  @Min(0)
  @Max(1000)
  protein?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'carbs must be a whole number of grams.' })
  @Min(0)
  @Max(2000)
  carbs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'fat must be a whole number of grams.' })
  @Min(0)
  @Max(1000)
  fat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'fiber must be a whole number of grams.' })
  @Min(0)
  @Max(200)
  fiber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'waterMl must be a whole number of millilitres.' })
  @Min(500)
  @Max(10000)
  waterMl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  mealsPerDay?: number;
}
