import * as z from 'zod';
import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';

/**
 * The contract the model must satisfy when generating a week of meals, and the
 * prompts that ask for it.
 *
 * Schema and prompt live together because they are one artefact: the schema is
 * embedded in the prompt, and any change to the shape has to be reflected in the
 * wording that motivates it. Splitting them is how the two drift apart.
 */

/** Meals per day the plan is built around, in the order they are eaten. */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

/**
 * The nutrition every generated dish carries.
 *
 * Fibre sits alongside the three macros rather than being treated as a detail of
 * carbohydrate: it is one of the daily targets the platform sets, the plan
 * screen shows it on every meal, and a plan that hits its calories while missing
 * its fibre is a plan that quietly fails at the thing it was built for.
 *
 * Upper bounds are sanity rails, not nutrition advice — they reject nonsense.
 */
const nutritionShape = {
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(500).describe('grams'),
  carbs: z.number().min(0).max(1000).describe('grams'),
  fat: z.number().min(0).max(500).describe('grams'),
  fiber: z.number().min(0).max(200).describe('grams'),
} as const;

/**
 * The rationale shown on the meal detail screen.
 *
 * Bounded tightly at both ends. Too short and it degenerates into a restatement
 * of the macros the user can already see; too long and it stops being read, and
 * a week of them stops fitting in one generation.
 */
const reasoningField = z
  .string()
  .min(60)
  .max(320)
  .describe(
    'One or two sentences on why this dish suits this person specifically — ' +
      'their goal, their targets, their declared conditions. Address them ' +
      'directly and name the property of the meal that does the work. No ' +
      'greeting, no restating the macro numbers.',
  );

/**
 * When to eat the meal, as 24-hour local wall-clock time.
 *
 * Asked for as a string in a fixed format rather than as a number of minutes,
 * because the pattern is what makes the answer checkable: a model that is free
 * to write "around 7am" or "07.30" produces something no client can lay out on
 * a timeline, and a plan whose times cannot be rendered is a plan with no times.
 *
 * A time and not a timestamp — "07:30 wherever you are" — so a user who travels
 * keeps the schedule they agreed to rather than eating breakfast at 3am.
 */
const scheduledTimeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe('Local 24-hour time to eat this meal, exactly "HH:MM", e.g. "07:30" or "19:00"');

export const mealPlanItemSchema = z.object({
  dayOfWeek: z
    .number()
    .int()
    .min(1)
    .max(7)
    .describe('ISO weekday: 1 = Monday through 7 = Sunday'),
  mealType: z.enum(MEAL_TYPES),
  time: scheduledTimeField,
  name: z.string().min(2).max(120).describe('Name of the dish, with no recipe or method'),
  ...nutritionShape,
  reasoning: reasoningField,
});

export const mealPlanGenerationSchema = z.object({
  items: z
    .array(mealPlanItemSchema)
    .min(7)
    .max(56)
    .describe('Every meal for all seven days'),
});

/**
 * One replacement dish, for the swap action on the meal detail screen.
 *
 * No time of its own: a swap replaces what is eaten, not when. The user is
 * looking at a meal slotted into their day, and moving it because the dish
 * changed would quietly reshuffle a schedule they never asked to change.
 */
export const mealSwapSchema = z.object({
  name: z.string().min(2).max(120).describe('Name of the dish, with no recipe or method'),
  ...nutritionShape,
  reasoning: reasoningField,
});

export type MealPlanGeneration = z.infer<typeof mealPlanGenerationSchema>;
export type GeneratedMealItem = z.infer<typeof mealPlanItemSchema>;
export type GeneratedMealSwap = z.infer<typeof mealSwapSchema>;

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
    `- Each day should land near ${targets.protein} g protein, ${targets.carbs} g carbs,`,
    `  ${targets.fat} g fat and ${targets.fiber} g fibre.`,
    '- Give every meal a `time`: the local 24-hour clock time to eat it, "HH:MM".',
    '  Space the day sensibly — breakfast within an hour or so of waking, three to',
    '  four hours between main meals, snacks in the gaps, and nothing heavy in the',
    '  last couple of hours before bed. Keep the same rhythm across the week so it',
    '  is a routine they can actually keep, and let their activity level and any',
    '  declared condition move it where that matters.',
    '- Give the name of the dish and its nutrition only. No recipes, no ingredient',
    '  lists, no cooking instructions, no portion descriptions.',
    '- Name dishes the way a cookbook would, not the way a label would: "Chicken',
    '  and vegetable stir-fry", not "High-Protein Lean Power Bowl". Plain names of',
    '  real dishes. The nutritional claim belongs in `reasoning`, never in the name.',
    '- Vary the meals across the week; do not repeat the same dish more than twice.',
    '- Respect the declared health conditions in every choice.',
    '- Nutrition must be per meal, not per day, and must be realistic for the dish named.',
    '- For every meal, explain in `reasoning` why that dish fits this person. Make it',
    '  specific to them: a snack that hits a protein gap, a dinner low enough in',
    '  sodium for their blood pressure. Never a generic line that would suit anyone.',
  ].join('\n');
}

/**
 * Builds the prompt for replacing a single meal.
 *
 * The nutrition of the dish being replaced is given as the budget to hit, not as
 * a suggestion. A swap is the user rejecting one dish, not the day's targets —
 * if the replacement drifts, every other meal in that day silently becomes wrong
 * too, and the plan they validated is no longer the plan they are following.
 */
export function buildMealSwapPrompt(
  context: UserContext,
  current: {
    mealType: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  },
  /** Other dishes already in the week, so the replacement is not one of them. */
  avoid: readonly string[],
): string {
  return [
    safetyPreamble(context),
    '',
    `Suggest one replacement ${current.mealType} for this person.`,
    '',
    'About this person:',
    describeUser(context),
    '',
    `They do not want "${current.name}" and have asked for something else.`,
    '',
    'Requirements:',
    '- Suggest a genuinely different dish — a different main ingredient and a',
    '  different style of meal, not a variation on the one being replaced.',
    `- Match its nutrition closely (within 10%): ${Math.round(current.calories)} kcal,`,
    `  ${Math.round(current.protein)} g protein, ${Math.round(current.carbs)} g carbs,`,
    `  ${Math.round(current.fat)} g fat, ${Math.round(current.fiber)} g fibre.`,
    '- Respect the declared health conditions.',
    '- Give the name of the dish and its nutrition only. No recipe, no method.',
    '- Explain in `reasoning` why this replacement fits this person specifically.',
    avoid.length > 0
      ? `- Already in their week, do not repeat: ${avoid.slice(0, 24).join('; ')}.`
      : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}
