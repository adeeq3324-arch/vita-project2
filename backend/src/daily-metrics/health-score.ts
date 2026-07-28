import type { MacroTotals } from '../meal-logs/meal-log.view';
import type { NutritionTargetView } from '../nutrition-targets/nutrition-target.view';

/**
 * The day's composite health score.
 *
 * A single 0–100 number summarising how closely the user followed their plan,
 * built from five weighted components. Calories are scored on *closeness* to
 * the target — overshooting a calorie goal is not an achievement, so the score
 * falls away either side of it — while protein, water and steps are scored on
 * attainment, where exceeding the target is simply full marks.
 */

export interface HealthScoreInputs {
  intake: MacroTotals;
  mealCount: number;
  waterMl: number;
  steps: number;
  stepsTarget: number;
  workoutCompleted: boolean;
  targets: Pick<NutritionTargetView, 'calories' | 'protein' | 'waterMl' | 'mealsPerDay'>;
}

/** Component weights. They sum to 1, so the result is directly a percentage. */
const WEIGHTS = {
  calories: 0.3,
  protein: 0.2,
  water: 0.15,
  steps: 0.15,
  workout: 0.1,
  logging: 0.1,
} as const;

/**
 * How far from the calorie target the score reaches zero, as a fraction of the
 * target. At ±40% the calorie component is fully lost; between the two it falls
 * off linearly from a full score at the target itself.
 */
const CALORIE_TOLERANCE = 0.4;

export interface HealthScoreBreakdown {
  score: number;
  components: {
    calories: number;
    protein: number;
    water: number;
    steps: number;
    workout: number;
    logging: number;
  };
}

/**
 * Scores attainment of a target: the ratio, capped at 1. A zero or missing
 * target scores full marks rather than dividing by zero — nothing was asked of
 * the user, so nothing can be missed.
 */
function attainment(value: number, target: number): number {
  if (target <= 0) return 1;
  return Math.min(1, Math.max(0, value / target));
}

/** Scores proximity to a target, penalising overshoot as much as undershoot. */
function proximity(value: number, target: number): number {
  if (target <= 0) return 1;
  const deviation = Math.abs(value - target) / target;
  return Math.max(0, 1 - deviation / CALORIE_TOLERANCE);
}

/**
 * Computes the day's score and the component values behind it, so the client
 * can explain the number rather than just displaying it.
 */
export function calculateHealthScore(inputs: HealthScoreInputs): HealthScoreBreakdown {
  const components = {
    calories: proximity(inputs.intake.kcal, inputs.targets.calories),
    protein: attainment(inputs.intake.protein, inputs.targets.protein),
    water: attainment(inputs.waterMl, inputs.targets.waterMl),
    steps: attainment(inputs.steps, inputs.stepsTarget),
    workout: inputs.workoutCompleted ? 1 : 0,
    logging: attainment(inputs.mealCount, inputs.targets.mealsPerDay),
  };

  const weighted =
    components.calories * WEIGHTS.calories +
    components.protein * WEIGHTS.protein +
    components.water * WEIGHTS.water +
    components.steps * WEIGHTS.steps +
    components.workout * WEIGHTS.workout +
    components.logging * WEIGHTS.logging;

  return {
    score: Math.round(weighted * 100),
    components: {
      calories: Math.round(components.calories * 100),
      protein: Math.round(components.protein * 100),
      water: Math.round(components.water * 100),
      steps: Math.round(components.steps * 100),
      workout: Math.round(components.workout * 100),
      logging: Math.round(components.logging * 100),
    },
  };
}

/** Plain-language band for a score, matching the labels on the Home card. */
export function healthScoreCaption(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 78) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs work';
}
