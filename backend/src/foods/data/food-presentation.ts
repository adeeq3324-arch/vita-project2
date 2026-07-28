import type { accentColorEnum, foodCategoryEnum } from '../../database/schema';

type FoodCategory = (typeof foodCategoryEnum.enumValues)[number];
type AccentColor = (typeof accentColorEnum.enumValues)[number];

/**
 * Design-system accent per food category. The client colour-codes food tiles by
 * category, so the mapping lives server-side and ships with the catalogue —
 * every surface that renders a food (search results, diary rows, scan results)
 * then agrees on the colour without duplicating the rule.
 */
export const CATEGORY_ACCENT: Record<FoodCategory, AccentColor> = {
  fruits: 'pink',
  vegetables: 'green',
  grains: 'orange',
  protein: 'red',
  seafood: 'cyan',
  dairy: 'violet',
  nuts_and_seeds: 'orange',
  fats_and_oils: 'orange',
  beverages: 'cyan',
  snacks: 'violet',
  sweets: 'pink',
  prepared_meals: 'green',
  condiments: 'neutral',
};

/** Fallback MaterialCommunityIcons glyph per category, when an item has none. */
export const CATEGORY_ICON: Record<FoodCategory, string> = {
  fruits: 'food-apple',
  vegetables: 'carrot',
  grains: 'barley',
  protein: 'food-drumstick',
  seafood: 'fish',
  dairy: 'cheese',
  nuts_and_seeds: 'peanut',
  fats_and_oils: 'bottle-tonic',
  beverages: 'cup',
  snacks: 'cookie',
  sweets: 'candy',
  prepared_meals: 'bowl-mix',
  condiments: 'sauce',
};

export type { AccentColor, FoodCategory };
