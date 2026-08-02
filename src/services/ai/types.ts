import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { AccentName } from '@/theme';

export type AIIcon = keyof typeof MaterialCommunityIcons.glyphMap;

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
