/**
 * VITAL AI — AI assistant service.
 *
 * A single entry point for every AI-generated experience in the app: the
 * coach, planning, and scanner analysers. Output is personalised from the
 * user's onboarding profile.
 *
 * The production model, prompts and credentials are configured server-side
 * through the environment (`env.aiEnabled`); the client never names or calls a
 * provider directly. These local generators produce the same typed, profile-
 * aware shapes the server will return, so screens stay unchanged when the live
 * service is wired in.
 */

export { coachGreeting, coachReply, coachSuggestions } from './coach';
export {
  aiRecommendation,
  dailyTotals,
  mealDetail,
  mealPlan,
  supplementDetail,
  supplementSchedule,
  weekSummary,
} from './plan';
export { analyzeFoodColor, analyzeFoodScan, analyzeProduct } from './scanner';

export type {
  DayPlan,
  FoodScanResult,
  FreshnessResult,
  MacroTotals,
  MealDetail,
  PlannedMeal,
  ProductResult,
  Supplement,
  SupplementDetail,
  WeekSummary,
} from './types';
