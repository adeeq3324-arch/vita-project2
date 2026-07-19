import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { AccentName } from '@/theme';
import type { MealType } from '@/types';

export type AIIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export type PlannedMeal = {
  type: MealType;
  name: string;
  kcal: number;
  prepMin: number;
  protein: number;
  carbs: number;
  fat: number;
  icon: AIIcon;
  accent: AccentName;
};

export type DayPlan = {
  day: number;
  meals: PlannedMeal[];
};

export type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Supplement = {
  id: string;
  name: string;
  time: string;
  timing: string;
  icon: AIIcon;
  accent: AccentName;
};

export type SupplementDetail = {
  name: string;
  icon: AIIcon;
  accent: AccentName;
  purpose: string;
  bestTime: string;
  dosage: string;
  tips: string;
};

export type WeekSummary = {
  mealsPlanned: number;
  supplements: number;
  recipes: number;
};

export type ScanNutrient = { label: string; value: number; unit: string };

export type FoodScanResult = {
  name: string;
  icon: AIIcon;
  accent: AccentName;
  calories: number;
  badge: string;
  nutrients: ScanNutrient[];
  healthScore: number;
  insight: string;
};

export type FreshnessResult = {
  score: number;
  label: string;
  summary: string;
  insights: string[];
};

export type ProductAlternative = { name: string; brand: string; rating: number };

export type ProductResult = {
  name: string;
  brand: string;
  icon: AIIcon;
  accent: AccentName;
  rating: number;
  ratingLabel: string;
  nutrients: ScanNutrient[];
  ingredients: string;
  insights: { text: string; positive: boolean }[];
  alternatives: ProductAlternative[];
};
