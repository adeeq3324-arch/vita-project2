import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalsService } from '../goals/goals.service';
import { HealthConditionsService } from '../health-conditions/health-conditions.service';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { ProfilesService } from '../profiles/profiles.service';

/**
 * Everything the AI layer is allowed to know about a user, assembled once.
 *
 * Meal plans, supplement plans, the coach and the scanners all need the same
 * picture of who they are answering for. Building it in one place means a change
 * to what the model is told — a new field, a different phrasing — lands in every
 * feature at once, and no feature can quietly personalise on something the
 * others do not see.
 */
export interface UserContext {
  name: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  timezone: string;

  primaryGoal: string;
  targetWeightKg: number | null;

  /** Declared health conditions; empty when the user reported none. */
  conditions: string[];

  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    waterMl: number;
    mealsPerDay: number;
  };
}

/** Turns an enum-ish stored value into something readable in a prompt. */
const humanise = (value: string): string => value.replace(/_/g, ' ');

@Injectable()
export class UserContextService {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly goals: GoalsService,
    private readonly healthConditions: HealthConditionsService,
    private readonly nutritionTargets: NutritionTargetsService,
  ) {}

  /**
   * Gathers the user's profile, goal, conditions and current targets.
   *
   * Throws when onboarding is incomplete: a personalised plan built on a missing
   * profile would be generic advice dressed up as personal, which is worse than
   * telling the client plainly that it has more to collect first.
   */
  async build(userId: string): Promise<UserContext> {
    const [profile, goal, conditions, targets] = await Promise.all([
      this.profiles.findRawByUserId(userId),
      this.goals.findRawByUserId(userId),
      this.healthConditions.list(userId),
      this.nutritionTargets.get(userId),
    ]);

    if (!profile || !goal) {
      throw new NotFoundException(
        'A personalised plan needs a profile and a goal. Complete onboarding first.',
      );
    }

    return {
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
      heightCm: Number(profile.heightCm),
      weightKg: Number(profile.weightKg),
      activityLevel: profile.activityLevel,
      timezone: profile.timezone,

      primaryGoal: goal.primaryGoal,
      targetWeightKg: goal.targetWeightKg === null ? null : Number(goal.targetWeightKg),

      conditions,

      targets: {
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat,
        fiber: targets.fiber,
        waterMl: targets.waterMl,
        mealsPerDay: targets.mealsPerDay,
      },
    };
  }
}

/**
 * Renders a context as the prompt block every AI feature embeds.
 *
 * Kept as a plain function beside the type so prompts stay consistent — the
 * model sees the same facts in the same order whichever feature is asking, which
 * is what makes their answers feel like one coach rather than four.
 */
export function describeUser(context: UserContext): string {
  const lines = [
    `Age: ${context.age}`,
    `Sex: ${humanise(context.gender)}`,
    `Height: ${context.heightCm} cm`,
    `Weight: ${context.weightKg} kg`,
    `Activity level: ${humanise(context.activityLevel)}`,
    `Primary goal: ${humanise(context.primaryGoal)}`,
  ];

  if (context.targetWeightKg !== null) {
    lines.push(`Target weight: ${context.targetWeightKg} kg`);
  }

  lines.push(
    context.conditions.length > 0
      ? `Health conditions: ${context.conditions.map(humanise).join(', ')}`
      : 'Health conditions: none declared',
  );

  lines.push(
    `Daily targets: ${context.targets.calories} kcal, ` +
      `${context.targets.protein} g protein, ` +
      `${context.targets.carbs} g carbs, ` +
      `${context.targets.fat} g fat, ` +
      `${context.targets.fiber} g fibre`,
    `Preferred meals per day: ${context.targets.mealsPerDay}`,
  );

  return lines.join('\n');
}

/**
 * The safety framing every health-related generation carries.
 *
 * Stated once, applied everywhere: the platform gives general wellness guidance,
 * not medical advice, and it must not contradict a declared condition.
 */
export function safetyPreamble(context: UserContext): string {
  const conditions =
    context.conditions.length > 0
      ? `The user has declared: ${context.conditions.map(humanise).join(', ')}. ` +
        'Nothing you suggest may conflict with those conditions.'
      : '';

  return [
    'You provide general nutrition and wellness guidance, not medical advice,',
    'diagnosis, or treatment. Never present a suggestion as a prescription.',
    conditions,
  ]
    .filter((line) => line.length > 0)
    .join(' ');
}
