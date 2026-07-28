import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { primaryGoalEnum } from '../../database/schema';

const PRIMARY_GOALS = primaryGoalEnum.enumValues;

/**
 * Partial goal update. Every field is optional; only those supplied are
 * changed. Mirrors the client's goal contract (`primaryGoal`, `targetWeight`
 * in kg).
 */
export class UpdateGoalDto {
  @IsOptional()
  @IsIn(PRIMARY_GOALS, { message: 'primaryGoal must be a valid primary goal.' })
  primaryGoal?: (typeof PRIMARY_GOALS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetWeight must be a number (kg).' })
  @Min(20)
  @Max(500)
  targetWeight?: number;
}
