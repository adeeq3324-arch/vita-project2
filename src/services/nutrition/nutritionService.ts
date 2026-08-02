import { api } from '@/services/api/client';
import type { MealType } from '@/types';

/**
 * Nutrition service — the food diary and the catalogue behind it.
 *
 * Entries are written server-side rather than held in the app: the diary is the
 * input every other surface reads from (the dashboard's totals, the analytics
 * charts, the achievement counters), so a meal that only exists on one device is
 * a meal the rest of the product cannot see.
 */

export interface MealLog {
  id: string;
  /** Catalogue entry this came from; null for custom entries. */
  foodId: string | null;
  name: string;
  mealType: MealType;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** MaterialCommunityIcons glyph name; resolve with `materialIcon()`. */
  icon: string;
  /** Design-system accent key; resolve with `accentName()`. */
  accent: string;
  /** Local clock time, e.g. "12:30 PM". */
  time: string;
  loggedAt: string;
  /** The calendar day this entry belongs to (YYYY-MM-DD). */
  date: string;
  dayLabel: string;
  /** Ready-made secondary line: "Today · 12:30 PM". */
  subtitle: string;
  notes: string | null;
}

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealLogDay {
  date: string;
  dayLabel: string;
  totals: MacroTotals;
  mealCount: number;
  meals: MealLog[];
}

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * A new diary entry, in the two shapes the server accepts:
 *
 *  - **from the catalogue** — `foodId` (and optionally `servings`); name and
 *    macros are taken from the food and scaled, so the client cannot submit
 *    nutrition that disagrees with the catalogue;
 *  - **custom** — `name` + `kcal` + macros, as the Add Custom Meal sheet and the
 *    scanners produce.
 */
export interface MealDraft {
  foodId?: string;
  servings?: number;
  name?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  mealType?: MealType;
  icon?: string;
  accent?: string;
  notes?: string;
}

/** One food in the searchable catalogue. */
export interface Food {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  serving: {
    label: string;
    grams: number;
  };
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
  icon: string;
  accent: string;
}

export interface FoodSearchResult {
  items: Food[];
  total: number;
  limit: number;
  offset: number;
}

/** Daily targets, derived from the profile unless the user overrode them. */
export interface NutritionTargets {
  userId: string;
  source: 'derived' | 'custom';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
  mealsPerDay: number;
  bmr: number;
  tdee: number;
  computedAt: string;
}

/** One diary day with its entries and totals. Defaults to today. */
export async function getDay(date?: string): Promise<MealLogDay> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return api.get<MealLogDay>(`/api/v1/meal-logs${query}`);
}

/** Newest entries across all days — the "Recent Meals" quick-add list. */
export async function getRecent(limit = 10): Promise<MealLog[]> {
  return api.get<MealLog[]>(`/api/v1/meal-logs/recent?limit=${limit}`);
}

/** Logs a meal and returns it as stored. */
export async function createMealLog(draft: MealDraft): Promise<MealLog> {
  return api.post<MealLog>('/api/v1/meal-logs', draft);
}

export async function deleteMealLog(id: string): Promise<void> {
  await api.delete<void>(`/api/v1/meal-logs/${id}`);
}

/**
 * Searches the food catalogue. An empty query returns the catalogue A–Z, which
 * is what the search screen shows before the user types.
 */
export async function searchFoods(query: string, limit = 20): Promise<FoodSearchResult> {
  const trimmed = query.trim();
  const q = trimmed ? `q=${encodeURIComponent(trimmed)}&` : '';
  return api.get<FoodSearchResult>(`/api/v1/foods/search?${q}limit=${limit}`);
}

/** The signed-in user's daily nutrition targets. */
export async function getTargets(): Promise<NutritionTargets> {
  return api.get<NutritionTargets>('/api/v1/nutrition/targets');
}
