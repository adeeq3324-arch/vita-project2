import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * VITAL AI — Plan generation state.
 *
 * Meal and supplement plans are AI-generated on demand: the user opens a plan,
 * taps "Generate", and the plan is built from their profile. This context holds
 * the generation status for each plan so the result persists while the app is
 * open (tapping into a detail and back doesn't re-trigger generation).
 */

export type PlanStatus = 'idle' | 'generating' | 'ready';
export type PlanKind = 'meal' | 'supplement';

type PlanContextValue = {
  status: Record<PlanKind, PlanStatus>;
  generate: (kind: PlanKind) => void;
  reset: (kind: PlanKind) => void;
};

/** How long the stub generation takes before the plan is ready. */
const GENERATION_MS = 1800;

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Record<PlanKind, PlanStatus>>({
    meal: 'idle',
    supplement: 'idle',
  });
  const timers = useRef<Record<PlanKind, ReturnType<typeof setTimeout> | null>>({
    meal: null,
    supplement: null,
  });

  const generate = useCallback((kind: PlanKind) => {
    if (timers.current[kind]) clearTimeout(timers.current[kind]!);
    setStatus((prev) => ({ ...prev, [kind]: 'generating' }));
    timers.current[kind] = setTimeout(() => {
      setStatus((prev) => ({ ...prev, [kind]: 'ready' }));
      timers.current[kind] = null;
    }, GENERATION_MS);
  }, []);

  const reset = useCallback((kind: PlanKind) => {
    if (timers.current[kind]) {
      clearTimeout(timers.current[kind]!);
      timers.current[kind] = null;
    }
    setStatus((prev) => ({ ...prev, [kind]: 'idle' }));
  }, []);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach((timer) => timer && clearTimeout(timer));
    },
    [],
  );

  const value = useMemo(() => ({ status, generate, reset }), [status, generate, reset]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
}
