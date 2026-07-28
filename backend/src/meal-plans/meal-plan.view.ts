import { addDays } from '../common/util/date.util';
import type { MealPlan, MealPlanItem } from '../database/schema';

/**
 * Client-facing shapes for a generated meal plan.
 *
 * The week is returned pre-grouped by day with per-day totals already summed:
 * the plan screen renders exactly this structure, and totalling on the server
 * means the figures shown always match the ones the plan was validated against.
 */

export interface MealPlanItemView {
  id: string;
  mealType: MealPlanItem['mealType'];
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanDayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
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

/** Order meals are eaten in, so a day never renders dinner before breakfast. */
const MEAL_ORDER: Record<MealPlanItem['mealType'], number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

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
      .sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType])
      .map(toItemView);

    return {
      dayOfWeek,
      date: addDays(weekStartDate, index),
      dayName,
      totals: sumDay(meals),
      meals,
    };
  });
}

function toItemView(item: MealPlanItem): MealPlanItemView {
  return {
    id: item.id,
    mealType: item.mealType,
    name: item.name,
    kcal: Math.round(Number(item.calories)),
    protein: round1(item.proteinG),
    carbs: round1(item.carbsG),
    fat: round1(item.fatG),
  };
}

function sumDay(meals: readonly MealPlanItemView[]): MealPlanDayTotals {
  const totals = meals.reduce(
    (acc, meal) => ({
      kcal: acc.kcal + meal.kcal,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
  };
}
