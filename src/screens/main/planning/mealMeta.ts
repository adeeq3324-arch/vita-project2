import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { MealType } from '@/types';

/**
 * How each sitting of the day is presented.
 *
 * One table, used by the day list, the detail hero and the fallback tile, so a
 * meal is labelled and iconed identically wherever it appears — a breakfast that
 * is a sun on one screen and a coffee cup on the next reads as two things.
 */

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const MEAL_ICON: Record<MealType, Glyph> = {
  breakfast: 'white-balance-sunny',
  lunch: 'bowl-mix',
  dinner: 'weather-night',
  snack: 'fruit-cherries',
};

/** Meals in the order they are eaten, for anything that has to lay them out. */
export const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
