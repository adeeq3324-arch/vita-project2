import { addDays } from '../common/util/date.util';
import type { MealPlan, MealPlanItem } from '../database/schema';

/**
 * Client-facing shapes for a generated meal plan.
 *
 * The week is returned pre-grouped by day with per-day totals already summed:
 * the plan screen renders exactly this structure, and totalling on the server
 * means the figures shown always match the ones the plan was validated against.
 */

/**
 * The measured extras behind a dish, for one serving.
 *
 * Only ever present on a meal whose nutrition was verified against a published
 * recipe — these are figures nobody can estimate, so a null here means "not
 * known" and never "none".
 */
export interface MealNutritionFactsView {
  /** Grams. */
  saturatedFat: number | null;
  /** Grams. */
  sugar: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  potassiumMg: number | null;
}

/** Attribution for a dish matched to a published recipe. */
export interface MealSourceView {
  /** Who published it, e.g. "foodista.com". */
  name: string;
  /** Where, so the client can offer to open the original. Null when unknown. */
  url: string | null;
}

export interface MealPlanItemView {
  id: string;
  /** ISO weekday the meal belongs to, so a detail view can name its day. */
  dayOfWeek: number;
  mealType: MealPlanItem['mealType'];
  /**
   * When to eat it, as local 24-hour "HH:MM". Null on plans generated before
   * the planner was asked to time meals, so the client shows no time at all
   * rather than inventing one.
   */
  scheduledTime: string | null;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /**
   * Whether the five figures above were measured or estimated. The client
   * labels them differently, so a guess is never shown as a measurement.
   */
  nutritionSource: MealPlanItem['nutritionSource'];
  /** Saturated fat, sugar, sodium and the rest. Null unless verified. */
  facts: MealNutritionFactsView | null;
  /** Why this dish suits the user's goal. Empty on plans generated before this existed. */
  reasoning: string;
  /** Photograph of the dish, or null when none has been attached. */
  imageUrl: string | null;
  /** Where the dish's photograph and figures came from. Null when unmatched. */
  source: MealSourceView | null;
}

export interface MealPlanDayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealPlanDayView {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  dayOfWeek: number;
  /** Calendar date this day falls on (YYYY-MM-DD). */
  date: string;
  /** Short weekday name, e.g. "Monday". */
  dayName: string;
  totals: MealPlanDayTotals;
  meals: MealPlanItemView[];
}

/** Status-only payload, for polling while generation is in flight. */
export interface MealPlanStatusView {
  mealPlanId: string;
  status: MealPlan['status'];
  /** Present only when generation failed. */
  error: string | null;
}

export interface MealPlanView extends MealPlanStatusView {
  weekStartDate: string;
  calorieTarget: number;
  /** Seven entries once ready; empty while generating. */
  days: MealPlanDayView[];
  createdAt: string;
  updatedAt: string;
}

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/**
 * Fallback order for meals with no time on them, so a day never renders dinner
 * before breakfast. Snacks sort last because without a clock there is nothing
 * to say where in the day one belongs.
 */
const MEAL_ORDER: Record<MealPlanItem['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

/**
 * Orders a day the way it will actually be lived.
 *
 * The clock wins wherever both meals carry one: a mid-morning snack belongs
 * between breakfast and lunch, and sorting by sitting alone would file it after
 * dinner. The sitting order is the fallback for plans generated before meals
 * were timed, which keeps those readable rather than arbitrary.
 *
 * "HH:MM" is fixed-width and zero-padded, so comparing the strings *is*
 * comparing the times — no parsing, and no zone to get wrong.
 */
function byTimeOfDay(a: MealPlanItem, b: MealPlanItem): number {
  const left = a.scheduledTime.trim();
  const right = b.scheduledTime.trim();

  if (left && right && left !== right) {
    return left < right ? -1 : 1;
  }
  return MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
}

const round1 = (value: string | number): number => Math.round(Number(value) * 10) / 10;

export function toMealPlanStatusView(plan: MealPlan): MealPlanStatusView {
  return { mealPlanId: plan.id, status: plan.status, error: plan.errorMessage };
}

export function toMealPlanView(plan: MealPlan, items: readonly MealPlanItem[]): MealPlanView {
  return {
    ...toMealPlanStatusView(plan),
    weekStartDate: plan.weekStartDate,
    calorieTarget: plan.calorieTarget,
    days: groupByDay(plan.weekStartDate, items),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/**
 * Buckets items into the seven days of the week.
 *
 * Days with no items are still emitted. A plan that came back short is a visible
 * gap in the UI rather than a week that quietly renders as six days, which is
 * the difference between a user seeing a problem and a user miscounting their
 * calories.
 */
function groupByDay(weekStartDate: string, items: readonly MealPlanItem[]): MealPlanDayView[] {
  if (items.length === 0) {
    return [];
  }

  return DAY_NAMES.map((dayName, index) => {
    const dayOfWeek = index + 1;
    const meals = items
      .filter((item) => item.dayOfWeek === dayOfWeek)
      .sort(byTimeOfDay)
      .map(toMealItemView);

    return {
      dayOfWeek,
      date: addDays(weekStartDate, index),
      dayName,
      totals: sumDay(meals),
      meals,
    };
  });
}

export function toMealItemView(item: MealPlanItem): MealPlanItemView {
  return {
    id: item.id,
    dayOfWeek: item.dayOfWeek,
    mealType: item.mealType,
    // Absent and empty are the same thing to a reader, and collapsing them here
    // leaves the client one case to render rather than two.
    scheduledTime: item.scheduledTime.trim() || null,
    name: item.name,
    kcal: Math.round(Number(item.calories)),
    protein: round1(item.proteinG),
    carbs: round1(item.carbsG),
    fat: round1(item.fatG),
    fiber: round1(item.fiberG),
    nutritionSource: item.nutritionSource,
    facts: item.nutritionFacts ?? null,
    reasoning: item.reasoning,
    imageUrl: item.imageUrl,
    // A source without a name is not attribution, so the whole block is dropped
    // rather than rendered as a link to nobody.
    source: item.sourceName ? { name: item.sourceName, url: item.sourceUrl } : null,
  };
}

function sumDay(meals: readonly MealPlanItemView[]): MealPlanDayTotals {
  const totals = meals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + meal.kcal,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
      fiber: acc.fiber + meal.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    fiber: Math.round(totals.fiber),
  };
}
