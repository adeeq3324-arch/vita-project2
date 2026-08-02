import type { OnboardingData } from '@/context/OnboardingContext';

import { activeConditions, calorieTarget, firstName, goalLabel, proteinTarget } from './profile';

/**
 * The one-line nudge on the Planning overview.
 *
 * Derived from the profile rather than fetched: it restates the user's own
 * targets back at them, which is something the client already knows and which
 * would be a wasteful model call to ask for. The plans themselves — the meals,
 * the supplements, and the reasoning behind each — come from the server
 * (`@/services/planning`), which is the only source of a generated plan.
 */
export function aiRecommendation(data: OnboardingData): string {
  const name = firstName(data);
  const active = activeConditions(data);

  if (data.goal === 'muscle_gain') {
    return `Increase your protein toward ${proteinTarget(data)}g today, ${name}, to push your ${goalLabel(data.goal).toLowerCase()} goal.`;
  }
  if (data.goal === 'weight_loss') {
    return `Swap one snack for vegetables to stay under ${calorieTarget(data)} kcal and keep your weight loss on track, ${name}.`;
  }
  if (active.length > 0) {
    return `Add more leafy greens today, ${name} — a simple win that supports both your goal and your health profile.`;
  }
  return `Add a serving of leafy greens today, ${name}, to round out your nutrition and energy.`;
}
