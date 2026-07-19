import type { ActivityLevel, Gender, HealthCondition, PrimaryGoal } from '@/types';

/**
 * Human-readable labels for the coded onboarding values. Shared by Profile,
 * the AI service and the planning screens so the same value always reads the
 * same way.
 */

export const goalLabels: Record<PrimaryGoal, string> = {
  muscle_gain: 'Muscle Gain',
  weight_loss: 'Weight Loss',
  healthy_lifestyle: 'Healthy Lifestyle',
};

export const genderLabels: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const activityLabels: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extremely_active: 'Extremely Active',
};

export const conditionLabels: Record<HealthCondition, string> = {
  diabetes: 'Diabetes',
  high_blood_pressure: 'High Blood Pressure',
  heart_conditions: 'Heart Conditions',
  asthma: 'Asthma',
  thyroid_problems: 'Thyroid Problems',
  high_cholesterol: 'High Cholesterol',
  kidney_problems: 'Kidney Problems',
  arthritis: 'Arthritis',
  pregnancy: 'Pregnancy',
  none: 'None',
};

export function goalLabel(goal: PrimaryGoal | null): string {
  return goal ? goalLabels[goal] : 'Healthy Lifestyle';
}

/** Comma-joined condition labels, excluding the "none" sentinel. */
export function conditionsSummary(conditions: HealthCondition[]): string {
  const real = conditions.filter((c) => c !== 'none');
  if (real.length === 0) return 'None';
  return real.map((c) => conditionLabels[c]).join(', ');
}

/** Count of real (non-"none") conditions, for compact summaries. */
export function conditionsCount(conditions: HealthCondition[]): number {
  return conditions.filter((c) => c !== 'none').length;
}
