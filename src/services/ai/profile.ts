import type { OnboardingData } from '@/context/OnboardingContext';
import { goalLabel } from '@/utils/profileLabels';
import type { HealthCondition } from '@/types';

/**
 * Derivations shared by the AI generators. These turn the raw onboarding data
 * into the targets and phrasing the assistant personalises its output with.
 */

export function firstName(data: OnboardingData): string {
  return data.username.trim().split(/\s+/)[0] || 'there';
}

function weightKg(data: OnboardingData): number {
  const parsed = parseFloat(data.weight);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

const activityFactor: Record<string, number> = {
  sedentary: 0.95,
  lightly_active: 1,
  moderately_active: 1.06,
  very_active: 1.12,
  extremely_active: 1.18,
};

/** Rough daily calorie target, shaped by goal then nudged by activity. */
export function calorieTarget(data: OnboardingData): number {
  const base = data.goal === 'weight_loss' ? 1850 : data.goal === 'muscle_gain' ? 2600 : 2200;
  const factor = data.activityLevel ? activityFactor[data.activityLevel] ?? 1 : 1;
  return Math.round((base * factor) / 10) * 10;
}

/** Daily protein target in grams — higher for muscle gain. */
export function proteinTarget(data: OnboardingData): number {
  const perKg = data.goal === 'muscle_gain' ? 2 : data.goal === 'weight_loss' ? 1.8 : 1.6;
  return Math.round(weightKg(data) * perKg);
}

/** Short phrase describing the user's goal, for sentence assembly. */
export function goalPhrase(data: OnboardingData): string {
  switch (data.goal) {
    case 'muscle_gain':
      return 'build lean muscle';
    case 'weight_loss':
      return 'lose weight steadily';
    default:
      return 'stay healthy and energised';
  }
}

/** Real (non-"none") conditions the assistant should account for. */
export function activeConditions(data: OnboardingData): HealthCondition[] {
  return data.conditions.filter((c) => c !== 'none');
}

/** One-line, condition-aware caution when relevant, else empty string. */
export function conditionNote(data: OnboardingData): string {
  const active = activeConditions(data);
  if (active.includes('diabetes')) return 'Keeping added sugars low to support your blood sugar.';
  if (active.includes('high_blood_pressure')) return 'Watching sodium to stay kind to your blood pressure.';
  if (active.includes('high_cholesterol')) return 'Favouring unsaturated fats to help your cholesterol.';
  if (active.includes('kidney_problems')) return 'Balancing protein carefully with your kidney health in mind.';
  if (active.includes('pregnancy')) return 'Prioritising nutrient-dense foods to support you both.';
  if (active.length > 0) return 'Tailored around the health conditions you shared.';
  return '';
}

export { goalLabel };
