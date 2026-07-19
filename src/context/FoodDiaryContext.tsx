import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AIIcon } from '@/services/ai/types';
import type { AccentName } from '@/theme';

/**
 * VITAL AI — Food diary.
 *
 * Today's logged meals, written to from the Food Scanner, Barcode Scanner and
 * the Add Meal screen, and read by Food Tracking. In memory for now; it moves
 * to the backend with the nutrition API.
 */

export type LoggedMeal = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  icon: AIIcon;
  accent: AccentName;
};

export type MealDraft = Omit<LoggedMeal, 'id' | 'time'>;

export type DiaryTotals = { kcal: number; protein: number; carbs: number; fat: number };

const seed: LoggedMeal[] = [
  { id: 'seed-1', name: 'Grilled Chicken Salad', kcal: 520, protein: 42, carbs: 30, fat: 24, time: '12:30 PM', icon: 'bowl-mix', accent: 'green' },
  { id: 'seed-2', name: 'Oatmeal with Berries', kcal: 340, protein: 12, carbs: 54, fat: 6, time: '8:30 AM', icon: 'coffee', accent: 'orange' },
  { id: 'seed-3', name: 'Protein Smoothie', kcal: 320, protein: 28, carbs: 40, fat: 7, time: '6:00 PM', icon: 'cup', accent: 'violet' },
];

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type FoodDiaryContextValue = {
  meals: LoggedMeal[];
  totals: DiaryTotals;
  addMeal: (draft: MealDraft) => void;
};

const FoodDiaryContext = createContext<FoodDiaryContextValue | null>(null);

export function FoodDiaryProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<LoggedMeal[]>(seed);

  const addMeal = useCallback((draft: MealDraft) => {
    setMeals((prev) => [
      { ...draft, id: `meal-${Date.now()}`, time: nowLabel() },
      ...prev,
    ]);
  }, []);

  const totals = useMemo<DiaryTotals>(
    () =>
      meals.reduce<DiaryTotals>(
        (acc, meal) => ({
          kcal: acc.kcal + meal.kcal,
          protein: acc.protein + meal.protein,
          carbs: acc.carbs + meal.carbs,
          fat: acc.fat + meal.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [meals],
  );

  const value = useMemo(() => ({ meals, totals, addMeal }), [meals, totals, addMeal]);

  return <FoodDiaryContext.Provider value={value}>{children}</FoodDiaryContext.Provider>;
}

export function useFoodDiary(): FoodDiaryContextValue {
  const context = useContext(FoodDiaryContext);
  if (!context) {
    throw new Error('useFoodDiary must be used inside a <FoodDiaryProvider>.');
  }
  return context;
}
