import type { Goal } from '../database/schema';

/** Client-facing goal representation (numeric target exposed as a number). */
export interface GoalView {
  id: string;
  userId: string;
  primaryGoal: Goal['primaryGoal'];
  targetWeight: number | null;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Maps a persisted goal row to its client-facing view. */
export function toGoalView(goal: Goal): GoalView {
  return {
    id: goal.id,
    userId: goal.userId,
    primaryGoal: goal.primaryGoal,
    targetWeight: goal.targetWeightKg === null ? null : Number(goal.targetWeightKg),
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}
