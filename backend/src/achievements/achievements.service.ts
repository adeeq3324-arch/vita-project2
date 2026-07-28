import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  isLoggedDay,
  trailingStreak,
  type AnalyticsWindow,
} from '../analytics/daily-series';
import { buildWeightJourney } from '../analytics/weight';
import { CacheKeys, CacheTtl } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import { achievements, type Goal, type NewAchievement } from '../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkoutLogsService } from '../workout-logs/workout-logs.service';
import {
  ACHIEVEMENTS,
  resolveLabel,
  resolveTarget,
  type AchievementDefinition,
  type AchievementMetrics,
} from './achievement.catalog';
import {
  buildDetail,
  toPercent,
  type AchievementsView,
  type AchievementView,
} from './achievement.view';

/** How far back streaks and day-counting metrics look. */
export const ACHIEVEMENT_WINDOW_DAYS = 90;

/** Health score at or above which a day counts as "perfect". */
const PERFECT_DAY_SCORE = 90;

/**
 * Above this many unlocks in one evaluation, a single summary push replaces the
 * individual ones. A user whose whole history is evaluated for the first time can
 * cross several lines at once, and eight separate notifications would read as a
 * malfunction rather than a celebration.
 */
const MAX_INDIVIDUAL_UNLOCK_PUSHES = 2;

/** An achievement's resolved state for one user, before it becomes a view. */
interface EvaluatedAchievement {
  definition: AchievementDefinition;
  target: number;
  progress: number;
  unlocked: boolean;
  unlockedAt: Date | null;
  /** True when it crossed its target during *this* evaluation. */
  isNew: boolean;
}

/**
 * Achievement tracking: badges, streaks and milestones.
 *
 * The catalogue is code and each user's standing is data
 * (`achievement.catalog.ts` explains why). This service is the bridge: it computes
 * every metric the catalogue can reference, resolves each definition against them,
 * and reconciles the result into the `achievements` table.
 *
 * Three properties are worth stating outright, because the unlock logic is only
 * trustworthy if all three hold:
 *
 *  - **Unlocks are permanent.** `unlocked_at` is written once and never moved. A
 *    streak that later breaks does not un-earn the badge it produced, which is the
 *    only reading of "achievement" a user would accept.
 *  - **Evaluation is idempotent.** Running it twice changes nothing the second
 *    time, so it is safe to run on every read.
 *  - **Notification is exactly once.** Only achievements that crossed their line
 *    *during this evaluation* are announced, and `notified_at` records it.
 */
@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly analytics: AnalyticsService,
    private readonly workouts: WorkoutLogsService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  /**
   * The user's achievement standing, re-evaluated behind a short cache.
   *
   * Reading evaluates on purpose: an achievement the user has already earned but
   * which nobody has computed yet is indistinguishable, to them, from a bug. The
   * cache is what makes that affordable, and because evaluation is idempotent the
   * write it may perform is safe on a GET.
   */
  async get(userId: string): Promise<AchievementsView> {
    const cached = await this.cache.get<AchievementsView>(CacheKeys.achievements(userId));
    if (cached) {
      return cached;
    }
    return this.evaluate(userId);
  }

  /**
   * Evaluates the catalogue against the user's current history, persisting the
   * result and announcing anything newly earned.
   *
   * The window is always the full {@link ACHIEVEMENT_WINDOW_DAYS} regardless of who
   * is asking: a 30-day streak milestone cannot be judged from the fortnight the
   * Progress tab happens to be showing.
   */
  async evaluate(userId: string): Promise<AchievementsView> {
    const window = await this.analytics.buildTrailingWindow(userId, ACHIEVEMENT_WINDOW_DAYS);

    const metrics = await this.computeMetrics(userId, window);
    const evaluated = await this.persist(userId, metrics);
    const view = this.toView(evaluated, window.goal?.primaryGoal ?? null);

    if (view.newlyUnlocked.length > 0) {
      await this.announce(userId, view.newlyUnlocked);
    }

    // Cached with `newlyUnlocked` emptied: a celebration is an event, and replaying
    // it to every request for the next five minutes would make it an annoyance.
    await this.cache.set(
      CacheKeys.achievements(userId),
      { ...view, newlyUnlocked: [] },
      CacheTtl.achievements,
    );

    return view;
  }

  // ── metrics ───────────────────────────────────────────────────────────────

  /**
   * Computes every metric the catalogue can reference.
   *
   * All of them come from one already-built analytics window plus three all-time
   * counts, so the cost does not grow with the size of the catalogue — adding a
   * badge that reuses an existing metric is free.
   */
  private async computeMetrics(
    userId: string,
    window: AnalyticsWindow,
  ): Promise<AchievementMetrics> {
    const [totalWorkouts, totalWorkoutMinutes, earlyWorkouts] = await Promise.all([
      this.workouts.totalSessions(userId),
      this.workouts.totalMinutes(userId),
      this.workouts.countEarlyWorkouts(userId, window.timeZone),
    ]);

    const proteinTarget = window.targets?.protein ?? 0;
    // The weight milestone reuses the shared journey so a bar on the Progress tab
    // and the milestone beneath it can never disagree about the same kilogram.
    const weight = buildWeightJourney(window);

    return {
      loggingStreakDays: trailingStreak(window.days, isLoggedDay),
      workoutStreakDays: trailingStreak(window.days, (day) => day.workouts.sessions > 0),
      hydrationStreakDays: trailingStreak(
        window.days,
        (day) => day.waterTargetMl > 0 && day.waterMl >= day.waterTargetMl,
      ),
      perfectDayStreak: trailingStreak(
        window.days,
        (day) => day.healthScore !== null && day.healthScore >= PERFECT_DAY_SCORE,
      ),
      proteinDaysMet:
        proteinTarget > 0
          ? window.days.filter((day) => day.intake.protein >= proteinTarget).length
          : 0,
      totalWorkouts,
      totalWorkoutMinutes,
      earlyWorkouts,
      weightProgressKg: weight.progressKg,
      weightGoalDistanceKg: weight.distanceKg,
    };
  }

  // ── persistence ───────────────────────────────────────────────────────────

  /**
   * Reconciles the evaluation into the `achievements` table.
   *
   * The existing rows are read first so a *new* unlock can be told apart from one
   * already on record — that difference is what decides whether the user is
   * congratulated. The write is a single upsert covering the whole catalogue, with
   * `unlocked_at` coalesced against the stored value so an earned date can never be
   * overwritten by a later evaluation.
   */
  private async persist(
    userId: string,
    metrics: AchievementMetrics,
  ): Promise<EvaluatedAchievement[]> {
    const existing = new Map(
      (await this.db.select().from(achievements).where(eq(achievements.userId, userId))).map(
        (row) => [row.key, row],
      ),
    );

    const now = new Date();
    const evaluated: EvaluatedAchievement[] = [];

    for (const definition of ACHIEVEMENTS) {
      const target = resolveTarget(definition, metrics);
      if (target === null) {
        // A personal target the user has not set — the milestone does not apply.
        continue;
      }

      // Progress is capped at the target: a milestone bar never reads past 100%,
      // and a badge gains nothing from recording how far past the line it went.
      const progress = Math.min(metrics[definition.metric], target);
      const previous = existing.get(definition.key);
      const alreadyUnlocked = previous?.unlockedAt != null;
      const crossed = progress >= target;

      evaluated.push({
        definition,
        target,
        progress,
        unlocked: alreadyUnlocked || crossed,
        unlockedAt: alreadyUnlocked ? previous.unlockedAt : crossed ? now : null,
        isNew: !alreadyUnlocked && crossed,
      });
    }

    if (evaluated.length === 0) {
      return evaluated;
    }

    const rows: NewAchievement[] = evaluated.map((entry) => ({
      userId,
      key: entry.definition.key,
      category: entry.definition.category,
      surface: entry.definition.surface,
      progress: entry.progress.toString(),
      target: entry.target.toString(),
      unlockedAt: entry.unlockedAt,
    }));

    await this.db
      .insert(achievements)
      .values(rows)
      .onConflictDoUpdate({
        target: [achievements.userId, achievements.key],
        set: {
          progress: sql`excluded.progress`,
          target: sql`excluded.target`,
          category: sql`excluded.category`,
          surface: sql`excluded.surface`,
          // An earned achievement keeps the instant it was earned, always.
          unlockedAt: sql`coalesce(${achievements.unlockedAt}, excluded.unlocked_at)`,
          updatedAt: now,
        },
      });

    return evaluated;
  }

  // ── presentation ──────────────────────────────────────────────────────────

  private toView(
    evaluated: readonly EvaluatedAchievement[],
    primaryGoal: Goal['primaryGoal'] | null,
  ): AchievementsView {
    const badges: AchievementView[] = [];
    const milestones: AchievementView[] = [];
    const newlyUnlocked: AchievementView[] = [];

    for (const entry of evaluated) {
      const view = this.toAchievementView(entry, primaryGoal);

      (entry.definition.surface === 'milestone' ? milestones : badges).push(view);
      if (entry.isNew) {
        newlyUnlocked.push(view);
      }
    }

    const all = [...badges, ...milestones];

    return {
      badges,
      milestones,
      earned: all.filter((view) => view.unlocked).length,
      total: all.length,
      newlyUnlocked,
    };
  }

  private toAchievementView(
    entry: EvaluatedAchievement,
    primaryGoal: Goal['primaryGoal'] | null,
  ): AchievementView {
    const { definition, target, progress } = entry;
    const decimals = definition.decimals ?? 0;

    return {
      key: definition.key,
      label: resolveLabel(definition, target, primaryGoal),
      description: definition.description,
      icon: definition.icon,
      accent: definition.accent,
      category: definition.category,
      unlocked: entry.unlocked,
      unlockedAt: entry.unlockedAt?.toISOString() ?? null,
      progress,
      target,
      percent: toPercent(progress, target),
      detail: buildDetail(progress, target, definition.unit, decimals),
    };
  }

  // ── notification ──────────────────────────────────────────────────────────

  /**
   * Congratulates the user and records that it happened.
   *
   * `notified_at` is written only for achievements a push actually went out for, so
   * a user with no registered device is never silently marked as told. Delivery
   * failures are swallowed entirely: the achievement is earned regardless, and the
   * unlock is visible the moment they open the app.
   */
  private async announce(userId: string, unlocked: readonly AchievementView[]): Promise<void> {
    const now = new Date();

    try {
      if (unlocked.length > MAX_INDIVIDUAL_UNLOCK_PUSHES) {
        const named = unlocked.slice(0, 3).map((view) => view.label).join(', ');
        const result = await this.notifications.sendToUser(userId, {
          title: `${unlocked.length} achievements unlocked 🏆`,
          body: `You've earned ${named} and more. Open VITAL AI to see them all.`,
          data: { type: 'achievement' },
        });

        if (result.delivered > 0) {
          await this.markNotified(userId, unlocked.map((view) => view.key), now);
        }
        return;
      }

      for (const view of unlocked) {
        const result = await this.notifications.sendToUser(userId, {
          title: 'Achievement unlocked 🏆',
          body: `${view.label} — ${view.description}`,
          data: { type: 'achievement', key: view.key },
        });

        if (result.delivered > 0) {
          await this.markNotified(userId, [view.key], now);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not announce ${unlocked.length} unlocked achievement(s) for ${userId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async markNotified(userId: string, keys: string[], now: Date): Promise<void> {
    await this.db
      .update(achievements)
      .set({ notifiedAt: now, updatedAt: now })
      .where(and(eq(achievements.userId, userId), inArray(achievements.key, keys)));
  }
}
