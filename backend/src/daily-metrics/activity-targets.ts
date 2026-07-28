import type { Profile } from '../database/schema';

/**
 * Daily step goals by self-reported activity level.
 *
 * A step target is a movement goal, not a nutrition one, so it is derived here
 * rather than stored on `nutrition_targets`. The values follow the common
 * public-health ladder: 10,000 steps for a typically active adult, scaled down
 * for sedentary users so the goal stays achievable, and up for very active ones
 * so it stays meaningful.
 */
export const STEPS_TARGET: Record<Profile['activityLevel'], number> = {
  sedentary: 6000,
  lightly_active: 8000,
  moderately_active: 10000,
  very_active: 12000,
  extremely_active: 14000,
};

/** Fallback used before onboarding sets an activity level. */
export const DEFAULT_STEPS_TARGET = STEPS_TARGET.moderately_active;

/** Fallback fluid goal, used when a user has no derived nutrition targets yet. */
export const DEFAULT_WATER_TARGET_ML = 2500;
