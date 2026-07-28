import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Shared Postgres enum types. These mirror the frontend's domain unions
 * (`src/types/index.ts`) one-to-one so the API contract and the database stay
 * in lockstep.
 */

/** Authentication provider a user account is linked to. */
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'apple']);

/** Biological sex / gender identity captured on the profile. */
export const genderEnum = pgEnum('gender', ['male', 'female', 'other', 'prefer_not_to_say']);

/** Self-reported weekly activity level, used for calorie/energy modelling. */
export const activityLevelEnum = pgEnum('activity_level', [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
]);

/** The user's headline fitness goal. */
export const primaryGoalEnum = pgEnum('primary_goal', [
  'muscle_gain',
  'weight_loss',
  'healthy_lifestyle',
]);

/** Measurement system the user prefers for display. Data is always stored metric. */
export const unitSystemEnum = pgEnum('unit_system', ['metric', 'imperial']);

/**
 * Catalogue of health conditions a user may declare. The frontend also has a
 * `none` sentinel; it is a UI-only marker ("no conditions") and is never
 * persisted, so it is deliberately absent here.
 */
export const healthConditionEnum = pgEnum('health_condition', [
  'diabetes',
  'high_blood_pressure',
  'heart_conditions',
  'asthma',
  'thyroid_problems',
  'high_cholesterol',
  'kidney_problems',
  'arthritis',
  'pregnancy',
]);

/** Which sitting of the day a diary entry belongs to. */
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack']);

/**
 * Decorative accent used to colour-code a food/meal tile. Mirrors the design
 * system's `AccentName` union (`src/theme/colors.ts`) so the API can hand the
 * client a ready-to-render colour key instead of the client guessing one.
 */
export const accentColorEnum = pgEnum('accent_color', [
  'violet',
  'orange',
  'cyan',
  'green',
  'pink',
  'red',
  'neutral',
]);

/** The accent keys {@link accentColorEnum} permits, as a TypeScript union. */
export type AccentColor = (typeof accentColorEnum.enumValues)[number];

/** Coarse grouping used to filter and colour-code the food catalogue. */
export const foodCategoryEnum = pgEnum('food_category', [
  'fruits',
  'vegetables',
  'grains',
  'protein',
  'seafood',
  'dairy',
  'nuts_and_seeds',
  'fats_and_oils',
  'beverages',
  'snacks',
  'sweets',
  'prepared_meals',
  'condiments',
]);

/**
 * Where a user's daily nutrition targets come from: `derived` targets are
 * recomputed from the profile/goal whenever those inputs change, `custom`
 * targets were set explicitly by the user and are never overwritten.
 */
export const nutritionTargetSourceEnum = pgEnum('nutrition_target_source', ['derived', 'custom']);

/**
 * Lifecycle of anything the AI layer produces asynchronously.
 *
 * Every generated artefact (a meal plan, a supplement plan) carries this on its
 * own row so the client polls one contract everywhere: `idle` the moment the
 * record is created, `generating` once a worker picks the job up, then `ready`
 * or `failed`.
 */
export const generationStatusEnum = pgEnum('generation_status', [
  'idle',
  'generating',
  'ready',
  'failed',
]);

/**
 * Lifecycle of the background job itself, as tracked on `ai_jobs`.
 *
 * Deliberately distinct from {@link generationStatusEnum}: this describes the
 * queue's view of the work (`queued` before a worker is free), while the domain
 * row describes the artefact's view of it. The two are kept in step by the job
 * tracker.
 */
export const aiJobStatusEnum = pgEnum('ai_job_status', [
  'queued',
  'processing',
  'ready',
  'failed',
]);

/** The kind of work an `ai_jobs` row represents. */
export const aiJobTypeEnum = pgEnum('ai_job_type', [
  'mealPlan',
  'supplementPlan',
  'foodScan',
  'colorScan',
  'barcodeScan',
  'coachChat',
]);

/** When during the day a supplement is best taken. */
export const supplementTimeEnum = pgEnum('supplement_time', [
  'morning',
  'afternoon',
  'evening',
  'withMeal',
]);

/** Which scanner produced a result. */
export const scanTypeEnum = pgEnum('scan_type', ['food', 'colorQuality', 'barcode']);

/**
 * The voice the AI health coach answers in. Chosen per conversation so a user
 * can keep separate threads with different coaching styles.
 */
export const coachPersonalityEnum = pgEnum('coach_personality', [
  'scientist',
  'motivator',
  'zenMaster',
]);

/** Who authored a coach message. */
export const coachRoleEnum = pgEnum('coach_role', ['user', 'assistant']);

/**
 * Kind of training session a workout log records. Broad enough to cover what a
 * general fitness app tracks, with `other` as the honest escape hatch — the
 * user's own `name` carries the specifics either way.
 */
export const workoutTypeEnum = pgEnum('workout_type', [
  'strength',
  'cardio',
  'hiit',
  'running',
  'cycling',
  'swimming',
  'walking',
  'yoga',
  'pilates',
  'crossfit',
  'sports',
  'stretching',
  'other',
]);

/** How hard a session was. Feeds the energy estimate when none was supplied. */
export const workoutIntensityEnum = pgEnum('workout_intensity', ['low', 'moderate', 'high']);

/** The span a progress snapshot rolls up. */
export const snapshotPeriodEnum = pgEnum('snapshot_period', ['week', 'month']);

/** What an achievement rewards, used to group the badge rail. */
export const achievementCategoryEnum = pgEnum('achievement_category', [
  'streak',
  'nutrition',
  'hydration',
  'fitness',
  'body',
  'consistency',
]);

/**
 * How an achievement is presented. `badge` entries are the medal rail —
 * earned or locked, nothing in between as far as the user is concerned. `milestone`
 * entries show their partial progress as a labelled bar, so a long goal reads as
 * "4.2 of 5 kg" rather than simply "not yet".
 */
export const achievementSurfaceEnum = pgEnum('achievement_surface', ['badge', 'milestone']);

/** What a reminder is nudging the user to do. Also picks its default icon/accent. */
export const reminderCategoryEnum = pgEnum('reminder_category', [
  'meal',
  'water',
  'workout',
  'supplement',
  'weighIn',
  'sleep',
  'custom',
]);

/** Which push service a registered device token belongs to. */
export const devicePlatformEnum = pgEnum('device_platform', ['ios', 'android', 'web']);
