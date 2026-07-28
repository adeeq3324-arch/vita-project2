import type { HealthCondition } from '@/types';

/**
 * Toggles one condition in a selection.
 *
 * "None of these" is mutually exclusive with every real condition: choosing it
 * clears the others, and choosing any other condition clears it. Shared by the
 * onboarding step and the profile editor so both enforce the same rule.
 */
export function nextConditions(
  current: HealthCondition[],
  condition: HealthCondition,
): HealthCondition[] {
  if (condition === 'none') {
    return current.includes('none') ? [] : ['none'];
  }
  const withoutNone = current.filter((item) => item !== 'none');
  return withoutNone.includes(condition)
    ? withoutNone.filter((item) => item !== condition)
    : [...withoutNone, condition];
}

/** True when both selections hold the same conditions, order aside. */
export function sameConditions(a: HealthCondition[], b: HealthCondition[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}
