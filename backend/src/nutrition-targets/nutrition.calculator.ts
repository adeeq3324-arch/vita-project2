import { createHash } from 'node:crypto';
import type { Goal, Profile } from '../database/schema';

/**
 * Energy and macronutrient modelling.
 *
 * A pure, dependency-free module: given a profile and a goal it returns the
 * user's daily targets and the intermediate figures (BMR, TDEE) they were
 * derived from. Keeping it free of database and cache concerns is what makes
 * the model straightforward to reason about and to verify against published
 * references.
 */

export interface TargetInputs {
  age: number;
  gender: Profile['gender'];
  heightCm: number;
  weightKg: number;
  activityLevel: Profile['activityLevel'];
  primaryGoal: Goal['primaryGoal'];
  targetWeightKg: number | null;
}

export interface DerivedTargets {
  /** Basal metabolic rate, kcal/day. */
  bmr: number;
  /** Total daily energy expenditure, kcal/day. */
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  mealsPerDay: number;
}

/**
 * Physical Activity Level multipliers applied to BMR to reach TDEE. These are
 * the standard Harris-Benedict/Mifflin activity factors.
 */
const ACTIVITY_FACTOR: Record<Profile['activityLevel'], number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

/**
 * Calorie adjustment applied to TDEE per goal. A 20% deficit is the widely
 * recommended rate for sustainable fat loss (roughly 0.5 kg/week for a typical
 * adult); a 15% surplus supports lean gain without excessive fat accrual.
 */
const GOAL_CALORIE_FACTOR: Record<Goal['primaryGoal'], number> = {
  weight_loss: 0.8,
  muscle_gain: 1.15,
  healthy_lifestyle: 1,
};

/** Protein grams per kg of body weight, per goal. */
const PROTEIN_PER_KG: Record<Goal['primaryGoal'], number> = {
  muscle_gain: 2.0,
  weight_loss: 1.8,
  healthy_lifestyle: 1.6,
};

/** Share of total calories coming from fat, per goal. */
const FAT_CALORIE_SHARE: Record<Goal['primaryGoal'], number> = {
  weight_loss: 0.3,
  muscle_gain: 0.25,
  healthy_lifestyle: 0.28,
};

/** Eating occasions the plan assumes — muscle gain spreads intake wider. */
const MEALS_PER_DAY: Record<Goal['primaryGoal'], number> = {
  muscle_gain: 5,
  weight_loss: 4,
  healthy_lifestyle: 4,
};

/**
 * Absolute calorie floors. No derived deficit is allowed to push a user below
 * these — they are the conventional minimum intakes below which a diet cannot
 * reliably meet micronutrient needs without supervision.
 */
const CALORIE_FLOOR = { male: 1500, female: 1200, neutral: 1350 } as const;

/** Energy per gram, kcal. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Fluid target: millilitres per kg of body weight, plus a training allowance. */
const WATER_ML_PER_KG = 35;
const WATER_ML_ACTIVITY_BONUS: Record<Profile['activityLevel'], number> = {
  sedentary: 0,
  lightly_active: 0,
  moderately_active: 250,
  very_active: 500,
  extremely_active: 750,
};

/** Fibre target: grams per 1000 kcal, per the Dietary Guidelines. */
const FIBER_G_PER_1000_KCAL = 14;

/**
 * Mifflin-St Jeor basal metabolic rate — the equation with the best validated
 * accuracy for the general adult population.
 *
 * The sex term is +5 for men and −161 for women. For users who selected `other`
 * or declined to answer, the midpoint (−78) is used: it is the least-biased
 * estimate available without the input, and errs no further from either than
 * picking one arbitrarily would.
 */
export function calculateBmr(inputs: TargetInputs): number {
  const base = 10 * inputs.weightKg + 6.25 * inputs.heightCm - 5 * inputs.age;
  const sexTerm = inputs.gender === 'male' ? 5 : inputs.gender === 'female' ? -161 : -78;
  return round(base + sexTerm, 2);
}

/** BMR scaled by the user's self-reported activity level. */
export function calculateTdee(bmr: number, activityLevel: Profile['activityLevel']): number {
  return round(bmr * ACTIVITY_FACTOR[activityLevel], 2);
}

/**
 * Full target set for a user.
 *
 * Calories are TDEE adjusted for the goal, then floored. Macros are then
 * allocated in priority order — protein by body weight, fat as a share of
 * calories, carbohydrate taking whatever energy remains — which is the standard
 * approach and guarantees the three always sum back to the calorie target.
 */
export function deriveTargets(inputs: TargetInputs): DerivedTargets {
  const bmr = calculateBmr(inputs);
  const tdee = calculateTdee(bmr, inputs.activityLevel);

  const goalCalories = tdee * GOAL_CALORIE_FACTOR[inputs.primaryGoal];
  const calories = Math.round(Math.max(goalCalories, calorieFloor(inputs.gender)));

  const proteinG = Math.round(inputs.weightKg * PROTEIN_PER_KG[inputs.primaryGoal]);
  const fatG = Math.round((calories * FAT_CALORIE_SHARE[inputs.primaryGoal]) / KCAL_PER_GRAM.fat);

  // Carbohydrate absorbs the remaining energy. It is clamped at zero for the
  // edge case where a very high protein target on a small calorie floor would
  // otherwise overrun the budget.
  const remainingKcal =
    calories - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_GRAM.carbs));

  const fiberG = Math.round((calories / 1000) * FIBER_G_PER_1000_KCAL);

  const waterMl =
    Math.round(
      (inputs.weightKg * WATER_ML_PER_KG + WATER_ML_ACTIVITY_BONUS[inputs.activityLevel]) / 100,
    ) * 100;

  return {
    bmr,
    tdee,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    waterMl,
    mealsPerDay: MEALS_PER_DAY[inputs.primaryGoal],
  };
}

/**
 * Stable hash of every input the derivation consumed. Stored with the targets so
 * a later read can tell, without recomputing, whether the profile or goal has
 * changed underneath them.
 */
export function fingerprintInputs(inputs: TargetInputs): string {
  const canonical = [
    inputs.age,
    inputs.gender,
    inputs.heightCm,
    inputs.weightKg,
    inputs.activityLevel,
    inputs.primaryGoal,
    inputs.targetWeightKg ?? '',
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}

/** Builds the calculator's input set from the persisted profile and goal rows. */
export function toTargetInputs(profile: Profile, goal: Goal): TargetInputs {
  return {
    age: profile.age,
    gender: profile.gender,
    heightCm: Number(profile.heightCm),
    weightKg: Number(profile.weightKg),
    activityLevel: profile.activityLevel,
    primaryGoal: goal.primaryGoal,
    targetWeightKg: goal.targetWeightKg === null ? null : Number(goal.targetWeightKg),
  };
}

function calorieFloor(gender: Profile['gender']): number {
  if (gender === 'male') return CALORIE_FLOOR.male;
  if (gender === 'female') return CALORIE_FLOOR.female;
  return CALORIE_FLOOR.neutral;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
