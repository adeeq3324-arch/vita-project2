import type { Food } from '../database/schema';

/**
 * The columns that make up a food's public representation. Deliberately narrower
 * than the table: the generated `search_vector` and the audit timestamps are
 * never sent to the client, and never even fetched.
 */
export interface FoodRecord {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: Food['category'];
  servingLabel: string;
  servingSizeG: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  sugarG: string;
  saturatedFatG: string;
  sodiumMg: string;
  icon: string;
  accent: Food['accent'];
}

/**
 * Client-facing food. Postgres `numeric` arrives as a string (so no precision is
 * lost in transit); it is converted to a number exactly once, here, so every
 * consumer downstream — including the client — works with plain JSON numbers.
 */
export interface FoodView {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: Food['category'];
  serving: {
    label: string;
    /** Grams (or millilitres for liquids) in one serving. */
    grams: number;
  };
  /** Energy per serving, kcal. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  /** Sodium per serving, milligrams. */
  sodium: number;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  /** Design-system accent key. */
  accent: Food['accent'];
}

/** Rounds to one decimal place, avoiding 0.30000000000000004-style artefacts. */
const toGrams = (value: string): number => Math.round(Number(value) * 10) / 10;

export function toFoodView(food: FoodRecord): FoodView {
  return {
    id: food.id,
    slug: food.slug,
    name: food.name,
    brand: food.brand,
    category: food.category,
    serving: {
      label: food.servingLabel,
      grams: toGrams(food.servingSizeG),
    },
    kcal: Math.round(Number(food.calories)),
    protein: toGrams(food.proteinG),
    carbs: toGrams(food.carbsG),
    fat: toGrams(food.fatG),
    fiber: toGrams(food.fiberG),
    sugar: toGrams(food.sugarG),
    saturatedFat: toGrams(food.saturatedFatG),
    sodium: Math.round(Number(food.sodiumMg)),
    icon: food.icon,
    accent: food.accent,
  };
}

/** A page of search results, with enough metadata for the client to paginate. */
export interface FoodSearchView {
  items: FoodView[];
  total: number;
  limit: number;
  offset: number;
}
