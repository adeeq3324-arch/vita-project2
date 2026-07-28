import { createHash } from 'node:crypto';

/**
 * Central registry of Redis cache keys.
 *
 * Keeping every key in one place means a producer and the modules that have to
 * invalidate it can never drift apart — `ProfilesService` busts the nutrition
 * target cache without importing anything from the nutrition module.
 *
 * `VERSION` is baked into every key: bumping it retires the entire cache in one
 * step, which is how a deploy that changes a cached payload's shape avoids
 * serving old-shaped JSON to new code.
 */
const VERSION = 'v1';
const ROOT = `vital:${VERSION}`;

/** Default lifetimes, in seconds. */
export const CacheTtl = {
  /** Targets change only when the profile/goal does, and that path invalidates. */
  nutritionTargets: 15 * 60,
  /** The food catalogue is seeded, not user-written: it is effectively static. */
  food: 24 * 60 * 60,
  foodSearch: 10 * 60,
  /**
   * The Progress tab aggregates a month of diaries, metrics and workouts into one
   * payload — by far the most expensive read in the app. Short-lived because the
   * numbers move whenever anything is logged, and every write path that can move
   * them invalidates the whole per-user prefix anyway.
   */
  progressOverview: 5 * 60,
  /** Snapshot history only changes when a period is rolled up. */
  progressSnapshots: 10 * 60,
  /** Achievement standing is re-evaluated behind this, from the same aggregates. */
  achievements: 5 * 60,
} as const;

/** Short, collision-resistant digest of a composite cache input. */
const digest = (value: string): string =>
  createHash('sha256').update(value).digest('base64url').slice(0, 22);

export const CacheKeys = {
  /** A user's computed daily nutrition targets. */
  nutritionTargets: (userId: string): string => `${ROOT}:nutrition:targets:${userId}`,

  /** A single catalogue entry by id. */
  food: (foodId: string): string => `${ROOT}:foods:item:${foodId}`,

  /** A rendered search page. Keyed by a digest of the full query parameters. */
  foodSearch: (params: {
    query: string;
    category: string | null;
    limit: number;
    offset: number;
  }): string =>
    `${ROOT}:foods:search:${digest(
      `${params.query.trim().toLowerCase()}|${params.category ?? ''}|${params.limit}|${params.offset}`,
    )}`,

  /** Prefix covering every cached food read (catalogue entries + search pages). */
  foodsPrefix: (): string => `${ROOT}:foods:`,

  /**
   * Prefix covering every cached analytics read for **one user**.
   *
   * The user id comes before the view name in all three keys below precisely so
   * this prefix exists: every write that can move a chart — a meal, a workout, a
   * weigh-in, a rolled-up period — drops one prefix rather than naming keys
   * individually, so a new cached view is invalidated correctly the day it is
   * added without every producer learning about it. It also guarantees one user's
   * writes can never evict another's cache.
   */
  analyticsPrefix: (userId: string): string => `${ROOT}:analytics:${userId}:`,

  /** A rendered Progress tab for one period ("week" / "month"). */
  progressOverview: (userId: string, period: string): string =>
    `${ROOT}:analytics:${userId}:overview:${period}`,

  /** A page of a user's snapshot history. */
  progressSnapshots: (userId: string, period: string, limit: number): string =>
    `${ROOT}:analytics:${userId}:snapshots:${period}:${limit}`,

  /** A user's evaluated achievement standing. */
  achievements: (userId: string): string => `${ROOT}:analytics:${userId}:achievements`,
} as const;
