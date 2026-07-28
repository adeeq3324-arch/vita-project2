import type { HealthConditionRow } from '../database/schema';
import { toGoalView, type GoalView } from '../goals/goal.view';
import type { ProfileView } from '../profiles/profile.view';

// Re-exported so existing importers (onboarding service/controller) keep a
// single import site; the canonical definition now lives with the goals module.
export { toGoalView, type GoalView };

/** Combined result of a successful onboarding submission. */
export interface OnboardingView {
  profile: ProfileView;
  goal: GoalView;
  conditions: HealthConditionRow['condition'][];
}

/**
 * The current user's persisted onboarding state, read back after sign-in.
 * Profile and goal are nullable so the endpoint can answer for a user who has
 * authenticated but not yet completed onboarding.
 */
export interface OnboardingOverview {
  profile: ProfileView | null;
  goal: GoalView | null;
  conditions: HealthConditionRow['condition'][];
}
