import type { OnboardingData } from '@/context/OnboardingContext';

import { activeConditions, conditionNote, goalLabel } from './profile';
import type { FoodScanResult, FreshnessResult, ProductResult } from './types';

/**
 * Scanner analysers (food photo, freshness, barcode). Stand in for the AI
 * service configured in the environment: results are shaped by the user's goal
 * and health profile so insights read as personalised, not generic.
 */

export function analyzeFoodScan(data: OnboardingData): FoodScanResult {
  const badge = data.goal === 'muscle_gain' ? 'High Protein' : data.goal === 'weight_loss' ? 'Low Calorie' : 'Balanced';
  const insight =
    data.goal === 'weight_loss'
      ? `This meal is light and filling — a smart pick for your ${goalLabel(data.goal).toLowerCase()} goal. ${conditionNote(data)}`.trim()
      : `This meal is high in protein and low in refined carbs. Perfect for your ${goalLabel(data.goal).toLowerCase()} goal! ${conditionNote(data)}`.trim();

  return {
    name: 'Grilled Chicken Salad',
    icon: 'bowl-mix',
    accent: 'green',
    calories: 520,
    badge,
    nutrients: [
      { label: 'Protein', value: 35, unit: 'g' },
      { label: 'Carbs', value: 28, unit: 'g' },
      { label: 'Fat', value: 22, unit: 'g' },
      { label: 'Fiber', value: 6, unit: 'g' },
      { label: 'Sugar', value: 4, unit: 'g' },
    ],
    healthScore: 8.7,
    insight,
  };
}

export function analyzeFoodColor(data: OnboardingData): FreshnessResult {
  const immunityNote = activeConditions(data).length > 0 ? 'Good for Immunity' : 'Great for Energy';
  return {
    score: 8.7,
    label: 'Very Fresh',
    summary: 'Your food looks fresh and high quality. Great choice!',
    insights: ['Rich in Antioxidants', 'High in Nutrients', immunityNote],
  };
}

export function analyzeProduct(data: OnboardingData): ProductResult {
  const active = activeConditions(data);
  const insights: ProductResult['insights'] = [
    { text: 'High in Protein', positive: true },
    { text: 'Contains Sugar Alcohols', positive: false },
    { text: 'Good for Post Workout', positive: true },
  ];
  if (active.includes('diabetes')) {
    insights.push({ text: 'Low added sugar — good for your profile', positive: true });
  }

  return {
    name: 'Quest Protein Bar',
    brand: 'Chocolate Chip Cookie Dough',
    icon: 'nutrition',
    accent: 'violet',
    rating: 7.8,
    ratingLabel: 'Good',
    nutrients: [
      { label: 'Calories', value: 190, unit: 'kcal' },
      { label: 'Protein', value: 21, unit: 'g' },
      { label: 'Carbs', value: 16, unit: 'g' },
      { label: 'Fat', value: 7, unit: 'g' },
      { label: 'Sugar', value: 1, unit: 'g' },
      { label: 'Fiber', value: 3, unit: 'g' },
    ],
    ingredients: 'Protein Blend (Milk Protein Isolate, Whey Protein Isolate), Almonds, Water, Erythritol, Cocoa Butter, Natural Flavors, Sea Salt.',
    insights,
    alternatives: [
      { name: 'Barebells Protein Bar', brand: 'Cookies & Cream', rating: 8.5 },
      { name: 'Grenade Protein Bar', brand: 'Fudge Brownie', rating: 8.0 },
    ],
  };
}
