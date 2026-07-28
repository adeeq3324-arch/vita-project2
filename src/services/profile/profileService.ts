import { api } from '@/services/api/client';
import type {
  ActivityLevel,
  Gender,
  HealthCondition,
  PrimaryGoal,
  UnitSystem,
} from '@/types';

/**
 * Profile service — reads and updates the signed-in user's persisted profile
 * against the VITAL AI backend. This is the source of truth for the account's
 * data after onboarding; the in-memory onboarding state is only the capture
 * buffer used while the user is filling the flow in.
 */

/** Persisted profile, as returned by `GET /api/v1/profiles/me`. */
export interface ProfileView {
  id: string;
  userId: string;
  username: string;
  age: number;
  gender: Gender;
  /** Height in centimetres. */
  height: number;
  /** Weight in kilograms. */
  weight: number;
  activityLevel: ActivityLevel;
  unitSystem: UnitSystem;
  createdAt: string;
  updatedAt: string;
}

/** Persisted goal, part of the onboarding overview. */
export interface GoalView {
  id: string;
  userId: string;
  primaryGoal: PrimaryGoal;
  /** Desired weight in kilograms; null when the user has no weight target. */
  targetWeight: number | null;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The user's full persisted onboarding state. Profile and goal are null when
 * the user has authenticated but not yet completed onboarding.
 */
export interface ProfileOverview {
  profile: ProfileView | null;
  goal: GoalView | null;
  conditions: Exclude<HealthCondition, 'none'>[];
}

/** Fields accepted by a partial profile update; only those supplied change. */
export interface UpdateProfileInput {
  username?: string;
  age?: number;
  gender?: Gender;
  /** Height in centimetres. */
  height?: number;
  /** Weight in kilograms. */
  weight?: number;
  activityLevel?: ActivityLevel;
  unitSystem?: UnitSystem;
}

/** Reads back the current user's persisted profile, goal and conditions. */
export async function getOverview(): Promise<ProfileOverview> {
  return api.get<ProfileOverview>('/api/v1/onboarding/me');
}

/** Applies a partial update to the current user's profile and returns it. */
export async function updateProfile(patch: UpdateProfileInput): Promise<ProfileView> {
  return api.patch<ProfileView>('/api/v1/profiles/me', patch);
}

/** Fields accepted by a partial goal update; only those supplied change. */
export interface UpdateGoalInput {
  primaryGoal?: PrimaryGoal;
  /** Desired weight in kilograms. */
  targetWeight?: number;
}

/** Applies a partial update to the current user's goal and returns it. */
export async function updateGoal(patch: UpdateGoalInput): Promise<GoalView> {
  return api.patch<GoalView>('/api/v1/goals/me', patch);
}

/**
 * Replaces the user's full set of declared health conditions with `conditions`
 * (the `none` sentinel is accepted and dropped server-side). Returns the
 * persisted set.
 */
export async function updateHealthConditions(
  conditions: HealthCondition[],
): Promise<Exclude<HealthCondition, 'none'>[]> {
  return api.put<Exclude<HealthCondition, 'none'>[]>('/api/v1/health-conditions/me', {
    conditions,
  });
}
