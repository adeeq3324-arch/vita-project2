import type { MealLog } from '../database/schema';
import { dayLabel, toLocalTimeLabel } from '../common/util/date.util';

/**
 * A single diary entry as the client renders it.
 *
 * Field names mirror the app's `LoggedMeal` shape (`src/context/FoodDiaryContext.tsx`)
 * exactly — `kcal`, `protein`, `carbs`, `fat`, `time`, `icon`, `accent` — so the
 * Food Tracking screen consumes the response without a mapping layer.
 */
export interface MealLogView {
  id: string;
  /** Catalogue entry this came from; null for custom entries. */
  foodId: string | null;
  name: string;
  mealType: MealLog['mealType'];
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  icon: string;
  accent: MealLog['accent'];
  /** Local clock time, e.g. "12:30 PM". */
  time: string;
  /** Exact instant, ISO-8601 — for clients that want to format it themselves. */
  loggedAt: string;
  /** The user's local calendar day this entry belongs to (YYYY-MM-DD). */
  date: string;
  /** "Today" / "Yesterday" / weekday / "12 Mar", relative to the user's today. */
  dayLabel: string;
  /** Ready-made secondary line for list rows: "Today · 12:30 PM". */
  subtitle: string;
  notes: string | null;
}

/** Running totals for a set of entries. */
export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** A full diary day: its entries plus the totals the donut chart renders. */
export interface MealLogDayView {
  date: string;
  dayLabel: string;
  totals: MacroTotals;
  mealCount: number;
  meals: MealLogView[];
}

/** One day's roll-up in "Meal History", without the individual entries. */
export interface MealHistoryDayView {
  date: string;
  dayLabel: string;
  totals: MacroTotals;
  mealCount: number;
}

const round1 = (value: string | number): number => Math.round(Number(value) * 10) / 10;

export function toMealLogView(log: MealLog, timeZone: string, today: string): MealLogView {
  const label = dayLabel(log.loggedOn, today);
  const time = toLocalTimeLabel(log.loggedAt, timeZone);

  return {
    id: log.id,
    foodId: log.foodId,
    name: log.name,
    mealType: log.mealType,
    servings: round1(log.servings),
    kcal: Math.round(Number(log.calories)),
    protein: round1(log.proteinG),
    carbs: round1(log.carbsG),
    fat: round1(log.fatG),
    fiber: round1(log.fiberG),
    icon: log.icon,
    accent: log.accent,
    time,
    loggedAt: log.loggedAt.toISOString(),
    date: log.loggedOn,
    dayLabel: label,
    subtitle: `${label} · ${time}`,
    notes: log.notes,
  };
}

/** Sums a set of views. Kept in one place so every surface totals identically. */
export function sumTotals(meals: readonly MealLogView[]): MacroTotals {
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

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
