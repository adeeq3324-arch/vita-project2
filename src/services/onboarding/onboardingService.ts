import { api } from '@/services/api/client';
import type { OnboardingData } from '@/context/OnboardingContext';

/**
 * Onboarding service — submits the completed onboarding form to the backend in
 * a single call (`POST /api/v1/onboarding/submit`), which persists the profile,
 * goal, and health conditions atomically. Requires an authenticated session.
 */

/** Payload shape accepted by the backend; mirrors the collected onboarding data. */
interface OnboardingPayload {
  goal: string;
  conditions: string[];
  username: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  activityLevel: string;
  targetWeight: string;
}

interface OnboardingResponse {
  profile: { id: string; userId: string };
  goal: { id: string };
  conditions: string[];
}

/**
 * Validates that onboarding is complete, then submits it. Throws if a required
 * selection is missing (the UI guards for this, but we fail loudly rather than
 * send an invalid payload).
 */
export async function submitOnboarding(data: OnboardingData): Promise<OnboardingResponse> {
  if (!data.goal || !data.gender || !data.activityLevel) {
    throw new Error('Onboarding is incomplete. Please finish every step before continuing.');
  }

  const payload: OnboardingPayload = {
    goal: data.goal,
    conditions: data.conditions,
    username: data.username,
    age: data.age,
    gender: data.gender,
    height: data.height,
    weight: data.weight,
    activityLevel: data.activityLevel,
    targetWeight: data.targetWeight,
  };

  return api.post<OnboardingResponse>('/api/v1/onboarding/submit', payload);
}
