import * as z from 'zod';
import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';

/**
 * The contract the model must satisfy when generating a week of meals, and the
 * prompt that asks for it.
 *
 * Schema and prompt live together because they are one artefact: the schema is
 * embedded in the prompt, and any change to the shape has to be reflected in the
 * wording that motivates it. Splitting them is how the two drift apart.
 */

/** Meals per day the plan is built around, in the order they are eaten. */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/** Upper bounds are sanity rails, not nutrition advice — they reject nonsense. */
export const mealPlanItemSchema = z.object({
  dayOfWeek: z
    .number()
    .int()
    .min(1)
    .max(7)
    .describe('ISO weekday: 1 = Monday through 7 = Sunday'),
  mealType: z.enum(MEAL_TYPES),
  name: z.string().min(2).max(120).describe('Name of the dish, with no recipe or method'),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(500).describe('grams'),
  carbs: z.number().min(0).max(1000).describe('grams'),
  fat: z.number().min(0).max(500).describe('grams'),
});

export const mealPlanGenerationSchema = z.object({
  items: z
    .array(mealPlanItemSchema)
    .min(7)
    .max(56)
    .describe('Every meal for all seven days'),
});

export type MealPlanGeneration = z.infer<typeof mealPlanGenerationSchema>;
export type GeneratedMealItem = z.infer<typeof mealPlanItemSchema>;

/** Voice and boundaries for the generator. */
export const MEAL_PLAN_SYSTEM_PROMPT = [
  'You are a registered-dietitian-level meal planner for a health and fitness',
  'platform. You produce practical, affordable, culturally unremarkable meals',
  'that an ordinary person can shop for and cook on a weeknight.',
  'You output data, never prose.',
].join(' ');

/**
 * Builds the generation prompt for one user's week.
 *
 * The daily calorie budget is stated as an explicit, checkable constraint rather
 * than left implicit in the targets, because a plan that does not add up to the
 * user's numbers is not merely imperfect — it silently undermines every progress
 * figure the rest of the app computes against those same targets.
 */
export function buildMealPlanPrompt(context: UserContext, weekStartDate: string): string {
  const { targets } = context;

  return [
    safetyPreamble(context),
    '',
    `Plan seven days of meals for the week beginning ${weekStartDate} (a Monday).`,
    '',
    'About this person:',
    describeUser(context),
    '',
    'Requirements:',
    `- Cover all 7 days, dayOfWeek 1 through 7, with ${targets.mealsPerDay} meals each day.`,
    `- Each day's meals must total close to ${targets.calories} kcal (within 5%).`,
    `- Each day should land near ${targets.protein} g protein, ${targets.carbs} g carbs`,
    `  and ${targets.fat} g fat.`,
    '- Give the name of the dish and its macros only. No recipes, no ingredient',
    '  lists, no cooking instructions, no portion descriptions.',
    '- Vary the meals across the week; do not repeat the same dish more than twice.',
    '- Respect the declared health conditions in every choice.',
    '- Macros must be per meal, not per day, and must be realistic for the dish named.',
  ].join('\n');
}
