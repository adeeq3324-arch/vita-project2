import { IsArray, IsIn } from 'class-validator';
import { healthConditionEnum } from '../../database/schema';

/** The client also sends the UI-only `none` sentinel, accepted then dropped. */
const CONDITION_VALUES = [...healthConditionEnum.enumValues, 'none'] as const;

/**
 * Replaces the caller's full set of declared health conditions. The client
 * sends the complete desired set (it may include the UI-only `none` sentinel,
 * which the service strips); the stored set is made to match exactly.
 */
export class UpdateHealthConditionsDto {
  @IsArray()
  @IsIn(CONDITION_VALUES, { each: true, message: 'conditions contains an unknown value.' })
  conditions!: (typeof CONDITION_VALUES)[number][];
}
