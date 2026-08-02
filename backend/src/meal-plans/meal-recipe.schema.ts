import * as z from 'zod';
import { describeUser, safetyPreamble, type UserContext } from '../ai-context/user-context.service';

/**
 * The contract for the recipe behind one planned meal, and the prompt that asks
 * for it.
 *
 * A plan names dishes; this is the only place the platform explains how to make
 * one. That makes the shape below load-bearing in a way the plan's own schema is
 * not: a method the reader cannot follow — vague quantities, steps that assume
 * knowledge, a time that bears no relation to the work — sends them to another
 * app for the thing they came here to do.
 *
 * The nutrition is never regenerated here. It was fixed when the plan was
 * validated against the user's targets, and a recipe that quietly disagreed with
 * the numbers shown on the meal it belongs to would make both untrustworthy. The
 * method is therefore asked to *fit* the nutrition it is given, not to restate
 * it.
 */

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

const ingredientSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .describe('The ingredient itself, e.g. "Chicken breast", "Olive oil"'),
  quantity: z
    .string()
    .min(1)
    .max(40)
    .describe(
      'How much the whole recipe needs, with a metric unit or a common measure, ' +
        'e.g. "200 g", "2 tbsp", "1 clove". Never a range, never "to taste" ' +
        'without an amount.',
    ),
  note: z
    .string()
    .max(60)
    .optional()
    .describe(
      'Optional preparation done before cooking starts, e.g. "finely diced", ' +
        '"drained and rinsed". Omit when there is none.',
    ),
});

const stepSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(50)
    .describe('What this step achieves, as a short imperative, e.g. "Sear the chicken"'),
  instruction: z
    .string()
    .min(30)
    .max(400)
    .describe(
      'How to do it, in full sentences: heat, pan, what to look for, when it is ' +
        'done. Written for someone who has not cooked this before.',
    ),
  minutes: z
    .number()
    .int()
    .min(0)
    .max(240)
    .describe('Roughly how long this step takes. 0 when it is instant.'),
});

export const mealRecipeSchema = z.object({
  summary: z
    .string()
    .min(60)
    .max(320)
    .describe(
      'Two or three sentences on what the dish is, how it tastes and why it is ' +
        'worth cooking. No greeting, no restating the macros.',
    ),
  cuisine: z
    .string()
    .min(3)
    .max(40)
    .describe('The culinary tradition it belongs to, e.g. "Mediterranean", "East African"'),
  difficulty: z
    .enum(DIFFICULTIES)
    .describe(
      'easy for a weeknight dish anyone can manage, medium when it needs timing ' +
        'or technique, hard when it needs real skill or long unattended stages',
    ),
  servings: z
    .number()
    .int()
    .min(1)
    .max(8)
    .describe('How many people the quantities below feed'),
  prepMinutes: z
    .number()
    .int()
    .min(0)
    .max(240)
    .describe('Hands-on preparation before cooking starts, in minutes'),
  cookMinutes: z
    .number()
    .int()
    .min(0)
    .max(480)
    .describe('Time cooking, in minutes. 0 for a no-cook dish.'),
  ingredients: z
    .array(ingredientSchema)
    .min(3)
    .max(20)
    .describe(
      'Everything needed, in the order it is used, including oil, salt and ' +
        'anything the method later refers to. Quantities are for the whole ' +
        'recipe as written, not per person.',
    ),
  steps: z
    .array(stepSchema)
    .min(3)
    .max(12)
    .describe('The method in order, one step per distinct action'),
  tips: z
    .array(z.string().min(20).max(180))
    .min(2)
    .max(5)
    .describe(
      'Practical advice a good cook would add: a substitution, how to store ' +
        'leftovers, the mistake to avoid. One sentence each.',
    ),
});

export type GeneratedMealRecipe = z.infer<typeof mealRecipeSchema>;

/** Voice and boundaries for the recipe writer. */
export const MEAL_RECIPE_SYSTEM_PROMPT = [
  'You are a professional recipe developer writing for a health and fitness',
  'platform. You write methods an ordinary home cook can follow on a weeknight,',
  'with ordinary equipment and ingredients from a normal supermarket.',
  'Every quantity is exact and every step says what to look for.',
  'You output data, never prose.',
].join(' ');

/**
 * Builds the prompt for one dish's recipe.
 *
 * The meal's own nutrition is handed over as a constraint the method has to land
 * on rather than as background. It is the figure the rest of the app has already
 * counted against the user's day, so a recipe whose portion is visibly bigger or
 * richer than the number beside it is not a cosmetic mismatch — it is the point
 * at which the user's calorie total stops being true.
 */
export function buildMealRecipePrompt(
  context: UserContext,
  meal: {
    name: string;
    mealType: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  },
): string {
  return [
    safetyPreamble(context),
    '',
    `Write the recipe for "${meal.name}", the ${meal.mealType} on this person's meal plan.`,
    '',
    'About this person:',
    describeUser(context),
    '',
    'Requirements:',
    '- One serving of this dish must come to roughly',
    `  ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)} g protein,`,
    `  ${Math.round(meal.carbs)} g carbs, ${Math.round(meal.fat)} g fat and`,
    `  ${Math.round(meal.fiber)} g fibre. Choose quantities that land there.`,
    '- State `servings` honestly and give quantities for the whole recipe, not per',
    '  person. If it is written for two, say two.',
    '- `prepMinutes` and `cookMinutes` must match the work actually described in the',
    '  steps. Do not round them down to look quick.',
    '- Every ingredient the method uses must appear in the ingredient list, including',
    '  oil, salt, pepper and water where they matter.',
    '- Steps go in order, one action each, and say what to look for rather than only',
    '  what to do — colour, texture, an internal temperature where it matters.',
    '- Respect the declared health conditions in the ingredients and the seasoning.',
    '- Keep to ingredients an ordinary supermarket sells and equipment an ordinary',
    '  kitchen has. No sous-vide, no speciality suppliers.',
    '- Write tips that are specific to this dish. Never generic filler.',
  ].join('\n');
}
