import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { SelectOption } from '@/components/ui/Select';
import type { AccentName } from '@/theme';
import type { ActivityLevel, Gender, HealthCondition, PrimaryGoal } from '@/types';

/**
 * VITAL AI — Profile option catalogues.
 *
 * Every choice below is offered twice: once during onboarding and again on the
 * profile edit screens. They live here so both surfaces always present the same
 * options, in the same order, with the same wording.
 */

export type GoalOption = {
  goal: PrimaryGoal;
  title: string;
  /** Two-line copy; the newline is deliberate for the card layout. */
  description: string;
};

export const goalOptions: readonly GoalOption[] = [
  { goal: 'muscle_gain', title: 'Muscle Gain', description: 'Build muscle and\nincrease strength' },
  { goal: 'weight_loss', title: 'Weight Loss', description: 'Lose weight and\nburn fat' },
  {
    goal: 'healthy_lifestyle',
    title: 'Healthy Lifestyle',
    description: 'Stay healthy and\nfeel your best',
  },
];

export type ConditionOption = {
  condition: HealthCondition;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: AccentName;
};

/** Ordered to fill the two-column grid row by row. */
export const conditionOptions: readonly ConditionOption[] = [
  { condition: 'diabetes', label: 'Diabetes', icon: 'water-outline', accent: 'violet' },
  { condition: 'high_blood_pressure', label: 'High Blood\nPressure', icon: 'gauge', accent: 'orange' },
  { condition: 'heart_conditions', label: 'Heart\nConditions', icon: 'heart-outline', accent: 'red' },
  { condition: 'asthma', label: 'Asthma', icon: 'lungs', accent: 'cyan' },
  { condition: 'thyroid_problems', label: 'Thyroid\nProblems', icon: 'flask-outline', accent: 'violet' },
  { condition: 'high_cholesterol', label: 'High\nCholesterol', icon: 'chart-donut', accent: 'orange' },
  { condition: 'kidney_problems', label: 'Kidney\nProblems', icon: 'blur', accent: 'cyan' },
  { condition: 'arthritis', label: 'Arthritis', icon: 'bone', accent: 'violet' },
  { condition: 'pregnancy', label: 'Pregnancy', icon: 'baby-carriage', accent: 'pink' },
  { condition: 'none', label: 'None of these', icon: 'cancel', accent: 'neutral' },
];

export const genderOptions: readonly SelectOption<Gender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const activityOptions: readonly SelectOption<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Sedentary — little or no exercise' },
  { value: 'lightly_active', label: 'Lightly Active — 1–3 days a week' },
  { value: 'moderately_active', label: 'Moderately Active — 3–5 days a week' },
  { value: 'very_active', label: 'Very Active — 6–7 days a week' },
  { value: 'extremely_active', label: 'Extremely Active — physical job or twice daily' },
];

/**
 * Accepted ranges, mirroring the backend validators (`UpdateProfileDto` /
 * `SubmitOnboardingDto`) so the client rejects what the API would reject.
 */
export const profileLimits = {
  age: { min: 1, max: 120 },
  height: { min: 50, max: 300 },
  weight: { min: 20, max: 500 },
  targetWeight: { min: 20, max: 500 },
} as const;
