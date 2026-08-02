import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '@/services/api/client';
import { isAuthenticated } from '@/services/auth/session';
import { emitDataChanged } from '@/services/dataBus';
import {
  createMealLog,
  deleteMealLog,
  getDay,
  EMPTY_TOTALS,
  type MacroTotals,
  type MealDraft,
  type MealLog,
} from '@/services/nutrition/nutritionService';

/**
 * VITAL AI — Food diary.
 *
 * Today's entries, written from the Food Scanner, the Barcode Scanner and Add
 * Meal, and read by Food Tracking and the dashboard. It is a context rather than
 * a per-screen fetch because four screens write to the same day and each must
 * see the others' writes immediately.
 *
 * The server owns the data and the arithmetic: totals come back with the day
 * rather than being summed here, so the figure on this screen and the figure on
 * the dashboard cannot drift apart.
 */

export type { MealDraft, MealLog } from '@/services/nutrition/nutritionService';

export type DiaryTotals = MacroTotals;

interface FoodDiaryContextValue {
  /** The day being shown (YYYY-MM-DD, resolved server-side in the user's zone). */
  date: string | null;
  meals: MealLog[];
  totals: DiaryTotals;
  mealCount: number;
  loading: boolean;
  error: ApiError | null;
  /** Re-reads today's diary. */
  refresh: () => Promise<void>;
  /** Logs a meal, then reflects it locally. Rejects if the write fails. */
  addMeal: (draft: MealDraft) => Promise<MealLog>;
  /** Removes an entry. Rejects if the write fails. */
  removeMeal: (id: string) => Promise<void>;
}

const FoodDiaryContext = createContext<FoodDiaryContextValue | null>(null);

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(
    error instanceof Error ? error.message : 'Could not reach the food diary.',
    0,
    error,
  );
}

interface DiaryState {
  day: {
    date: string;
    meals: MealLog[];
    totals: DiaryTotals;
    mealCount: number;
  } | null;
  loading: boolean;
  error: ApiError | null;
}

export function FoodDiaryProvider({ children }: { children: ReactNode }) {
  // The provider sits above the navigator, so it mounts before sign-in. Starting
  // in the loading state only when there is already a session means the very
  // first render is correct for both cases without an effect having to correct
  // it a frame later.
  const [state, setState] = useState<DiaryState>(() => ({
    day: null,
    loading: isAuthenticated(),
    error: null,
  }));

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    // Reading without a session is a guaranteed 401; the diary screens call this
    // again once the user is through the door.
    if (!isAuthenticated()) return;

    try {
      const result = await getDay();
      if (!mounted.current) return;
      setState({
        day: {
          date: result.date,
          meals: result.meals,
          totals: result.totals,
          mealCount: result.mealCount,
        },
        loading: false,
        error: null,
      });
    } catch (caught) {
      if (!mounted.current) return;
      setState((current) => ({ ...current, loading: false, error: toApiError(caught) }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addMeal = useCallback(
    async (draft: MealDraft): Promise<MealLog> => {
      const saved = await createMealLog(draft);
      // Re-read rather than splice: the day's totals, and whether the entry even
      // belongs to today, are the server's to decide.
      await refresh();
      // Calories, macros, the health score and the streak all move with a meal.
      emitDataChanged('diary');
      return saved;
    },
    [refresh],
  );

  const removeMeal = useCallback(
    async (id: string): Promise<void> => {
      await deleteMealLog(id);
      await refresh();
      emitDataChanged('diary');
    },
    [refresh],
  );

  const value = useMemo<FoodDiaryContextValue>(
    () => ({
      date: state.day?.date ?? null,
      meals: state.day?.meals ?? [],
      totals: state.day?.totals ?? EMPTY_TOTALS,
      mealCount: state.day?.mealCount ?? 0,
      loading: state.loading,
      error: state.error,
      refresh,
      addMeal,
      removeMeal,
    }),
    [state, refresh, addMeal, removeMeal],
  );

  return <FoodDiaryContext.Provider value={value}>{children}</FoodDiaryContext.Provider>;
}

export function useFoodDiary(): FoodDiaryContextValue {
  const context = useContext(FoodDiaryContext);
  if (!context) {
    throw new Error('useFoodDiary must be used inside a <FoodDiaryProvider>.');
  }
  return context;
}
