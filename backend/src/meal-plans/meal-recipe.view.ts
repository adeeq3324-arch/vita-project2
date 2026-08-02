import type { MealPlanItem, MealRecipe } from '../database/schema';

/**
 * The client-facing shape of a recipe.
 *
 * Carries the dish it belongs to as well as the method, so the recipe screen is
 * whole from a single response — its hero, its title and its nutrition all come
 * from here rather than from params the caller happened to have. That is what
 * makes the screen openable from a notification or a deep link and not only from
 * the meal it was pushed off.
 */

export interface RecipeIngredientView {
  name: string;
  /** How much the whole recipe needs, with its unit. */
  quantity: string;
  /** Preparation done before cooking, when the step calls for it. */
  note: string | null;
}

export interface RecipeStepView {
  /** 1-based position, so the client never has to derive it from an array index. */
  number: number;
  title: string;
  instruction: string;
  /** Roughly how long it takes. Null when the step is instant. */
  minutes: number | null;
}

export interface MealRecipeView {
  /** The meal this recipe belongs to. */
  mealId: string;
  name: string;
  mealType: MealPlanItem['mealType'];
  imageUrl: string | null;

  /** Nutrition of one portion as the plan counted it — never recomputed here. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;

  summary: string;
  cuisine: string;
  difficulty: MealRecipe['difficulty'];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  /** Prep plus cook, summed here so every surface shows the same total. */
  totalMinutes: number;

  ingredients: RecipeIngredientView[];
  steps: RecipeStepView[];
  tips: string[];

  /**
   * Who published this method, when it was published rather than generated.
   *
   * Null for a recipe the model wrote, and that difference is the whole point:
   * a real cook's recipe is credited to them, and the reader can tell at a
   * glance which kind they are following.
   */
  source: { name: string; url: string | null } | null;
}

const round1 = (value: string | number): number => Math.round(Number(value) * 10) / 10;

export function toMealRecipeView(meal: MealPlanItem, recipe: MealRecipe): MealRecipeView {
  return {
    mealId: meal.id,
    name: meal.name,
    mealType: meal.mealType,
    imageUrl: meal.imageUrl,

    kcal: Math.round(Number(meal.calories)),
    protein: round1(meal.proteinG),
    carbs: round1(meal.carbsG),
    fat: round1(meal.fatG),
    fiber: round1(meal.fiberG),

    summary: recipe.summary,
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,

    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      // Absent and empty are the same thing to a reader, and collapsing them
      // here means the client has one case to render rather than two.
      note: ingredient.note?.trim() ? ingredient.note : null,
    })),
    steps: recipe.steps.map((step, index) => ({
      number: index + 1,
      title: step.title,
      instruction: step.instruction,
      // Zero is the model's way of saying "instant"; the client should show
      // nothing at all rather than a "0 min" badge.
      minutes: step.minutes && step.minutes > 0 ? step.minutes : null,
    })),
    tips: recipe.tips,
    source: recipe.sourceName ? { name: recipe.sourceName, url: recipe.sourceUrl } : null,
  };
}
