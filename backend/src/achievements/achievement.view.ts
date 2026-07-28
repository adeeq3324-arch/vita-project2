import type { AccentColor, AchievementCategory } from '../database/schema';

/**
 * One achievement as the client renders it.
 *
 * Covers both surfaces with one shape. A badge only reads `label`, `icon`,
 * `accent` and `unlocked`; a milestone additionally reads `percent` and `detail`.
 * Sending both means the Progress tab's badge rail and its milestone bars are fed
 * from one array, and a definition can be moved between the two without a client
 * change.
 *
 * `accent` is a design-system key rather than a colour value — the same contract
 * the rest of the API uses — so the palette stays owned by the app.
 */
export interface AchievementView {
  key: string;
  label: string;
  description: string;
  icon: string;
  accent: AccentColor;
  category: AchievementCategory;
  unlocked: boolean;
  /** Instant it was earned, ISO-8601; null while locked. */
  unlockedAt: string | null;
  /** Progress in the achievement's own unit. */
  progress: number;
  target: number;
  /** Completion, 0–100, clamped. */
  percent: number;
  /** Milestone detail line: "4.2 of 5 kg", "12 of 30 days". */
  detail: string;
}

/**
 * The full engagement payload: the badge rail, the milestone list, and whatever
 * was earned in the course of this evaluation.
 */
export interface AchievementsView {
  /** Badges, in catalogue order — earned ones first is a client decision. */
  badges: AchievementView[];
  /** Milestones with partial progress shown as a bar. */
  milestones: AchievementView[];
  earned: number;
  total: number;
  /**
   * Achievements that crossed their target during *this* evaluation. Lets the
   * client celebrate immediately instead of diffing two responses.
   */
  newlyUnlocked: AchievementView[];
}

export const EMPTY_ACHIEVEMENTS_VIEW: AchievementsView = {
  badges: [],
  milestones: [],
  earned: 0,
  total: 0,
  newlyUnlocked: [],
};

/** Renders a progress figure at the achievement's own precision. */
export function formatAmount(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

/** "12 of 30 days" — the milestone detail line, with the unit omitted when blank. */
export function buildDetail(
  progress: number,
  target: number,
  unit: string,
  decimals: number,
): string {
  const amounts = `${formatAmount(progress, decimals)} of ${formatAmount(target, decimals)}`;
  return unit ? `${amounts} ${unit}` : amounts;
}

/** Completion as a whole percentage, clamped to 0–100. */
export function toPercent(progress: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, progress / target)) * 100);
}
