import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { CacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { addDays, dayLabel, toLocalDate, todayIn } from '../common/util/date.util';
import { DailyMetricsService } from '../daily-metrics/daily-metrics.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import { workoutLogs, type NewWorkoutLog, type WorkoutLog } from '../database/schema';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateWorkoutLogDto } from './dto/create-workout-log.dto';
import {
  DEFAULT_HISTORY_DAYS,
  DEFAULT_RECENT_LIMIT,
  MAX_HISTORY_DAYS,
  MAX_RECENT_LIMIT,
  type RecentWorkoutsQueryDto,
  type WorkoutHistoryQueryDto,
} from './dto/query-workout-logs.dto';
import type { UpdateWorkoutLogDto } from './dto/update-workout-log.dto';
import {
  EMPTY_WORKOUT_TOTALS,
  sumWorkoutTotals,
  toWorkoutLogView,
  type WorkoutDayView,
  type WorkoutHistoryDayView,
  type WorkoutLogView,
  type WorkoutSummaryView,
  type WorkoutTotals,
} from './workout-log.view';
import {
  estimateCaloriesBurned,
  workoutTypeAccent,
  workoutTypeIcon,
  workoutTypeLabel,
} from './workout.presentation';

/** How far back a streak is chased before it is considered long enough. */
const STREAK_LOOKBACK_DAYS = 365;

/** Hour of the local morning before which a session counts as an early one. */
const EARLY_WORKOUT_BEFORE_HOUR = 8;

/** Default window for the summary: the trailing month, as the Fitness card shows. */
const SUMMARY_DAYS = 30;

/**
 * The training diary. Every query is scoped to the caller's `user_id`, so a user
 * can only ever read or mutate their own sessions — the application-level
 * guarantee that sits in front of the database's RLS policies.
 *
 * Two things happen on every write beyond the row itself:
 *
 *  - **`daily_metrics` is re-synced** for the affected day. That table carries
 *    `workout_completed` / `workout_minutes`, which the home dashboard and the
 *    health score already read; recomputing them from the diary means the two can
 *    never disagree, and a session logged here immediately moves the day's score.
 *    Editing a session that *moves* days re-syncs both the old day and the new one.
 *  - **Cached analytics are dropped** for the user, because every workout changes
 *    the Progress tab's fitness chart and can unlock an achievement.
 */
@Injectable()
export class WorkoutLogsService {
  private readonly logger = new Logger(WorkoutLogsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly profiles: ProfilesService,
    private readonly dailyMetrics: DailyMetricsService,
    private readonly cache: CacheService,
  ) {}

  async create(userId: string, dto: CreateWorkoutLogDto): Promise<WorkoutLogView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const performedAt = dto.performedAt ? new Date(dto.performedAt) : new Date();
    const performedOn = dto.date ?? toLocalDate(performedAt, timeZone);
    const intensity = dto.intensity ?? 'moderate';

    const values: NewWorkoutLog = {
      userId,
      type: dto.type,
      name: dto.name?.trim() || workoutTypeLabel(dto.type),
      durationMinutes: dto.durationMinutes,
      intensity,
      caloriesBurned:
        dto.caloriesBurned ??
        (await this.estimate(userId, dto.type, intensity, dto.durationMinutes)),
      performedAt,
      performedOn,
      icon: dto.icon ?? workoutTypeIcon(dto.type),
      accent: dto.accent ?? workoutTypeAccent(dto.type),
      notes: dto.notes?.trim() || null,
    };

    const [created] = await this.db.insert(workoutLogs).values(values).returning();

    await this.afterChange(userId, [performedOn]);
    return toWorkoutLogView(created, timeZone, todayIn(timeZone));
  }

  /** One training day: its sessions newest-first, plus the day's totals. */
  async getDay(userId: string, date?: string): Promise<WorkoutDayView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const day = date ?? today;

    const rows = await this.db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.performedOn, day)))
      .orderBy(desc(workoutLogs.performedAt));

    const workouts = rows.map((row) => toWorkoutLogView(row, timeZone, today));

    return {
      date: day,
      dayLabel: dayLabel(day, today),
      totals: sumWorkoutTotals(workouts),
      workouts,
    };
  }

  /** The newest sessions across all days, optionally narrowed to one type. */
  async getRecent(userId: string, query: RecentWorkoutsQueryDto): Promise<WorkoutLogView[]> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const take = Math.min(query.limit ?? DEFAULT_RECENT_LIMIT, MAX_RECENT_LIMIT);

    const rows = await this.db
      .select()
      .from(workoutLogs)
      .where(
        query.type
          ? and(eq(workoutLogs.userId, userId), eq(workoutLogs.type, query.type))
          : eq(workoutLogs.userId, userId),
      )
      .orderBy(desc(workoutLogs.performedAt))
      .limit(take);

    return rows.map((row) => toWorkoutLogView(row, timeZone, today));
  }

  /**
   * One roll-up per day over the requested window, newest day first. Days with no
   * session are included as zero rows so the client can render an unbroken series
   * without filling gaps itself.
   */
  async getHistory(
    userId: string,
    query: WorkoutHistoryQueryDto,
  ): Promise<WorkoutHistoryDayView[]> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const { from, to } = this.resolveRange(query, today);

    const totalsByDate = await this.totalsByDate(userId, from, to);

    const days: WorkoutHistoryDayView[] = [];
    for (let day = to; day >= from; day = addDays(day, -1)) {
      days.push({
        date: day,
        dayLabel: dayLabel(day, today),
        totals: totalsByDate.get(day) ?? { ...EMPTY_WORKOUT_TOTALS },
      });
    }
    return days;
  }

  async getById(userId: string, id: string): Promise<WorkoutLogView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const log = await this.findOwned(userId, id);
    return toWorkoutLogView(log, timeZone, todayIn(timeZone));
  }

  async update(userId: string, id: string, dto: UpdateWorkoutLogDto): Promise<WorkoutLogView> {
    const existing = await this.findOwned(userId, id);
    const timeZone = await this.profiles.getTimeZone(userId);

    const changes = await this.toColumnChanges(userId, existing, dto, timeZone);

    if (Object.keys(changes).length === 0) {
      return toWorkoutLogView(existing, timeZone, todayIn(timeZone));
    }

    const [updated] = await this.db
      .update(workoutLogs)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)))
      .returning();

    // Both days need re-syncing when the session moved between them; the set
    // collapses to one entry when it did not.
    await this.afterChange(userId, [existing.performedOn, updated.performedOn]);
    return toWorkoutLogView(updated, timeZone, todayIn(timeZone));
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(workoutLogs)
      .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)))
      .returning({ performedOn: workoutLogs.performedOn });

    if (deleted.length === 0) {
      throw new NotFoundException(`No workout log found with id "${id}".`);
    }

    await this.afterChange(userId, [deleted[0].performedOn]);
  }

  // ── aggregates shared with progress analytics and achievements ─────────────

  /**
   * Per-day training totals across a date range, aggregated in Postgres. Shared
   * by workout history, the Progress tab's frequency chart and every snapshot
   * roll-up, so all three read the same numbers from the same query.
   */
  async totalsByDate(
    userId: string,
    from: string,
    to: string,
  ): Promise<Map<string, WorkoutTotals>> {
    const rows = await this.db
      .select({
        date: workoutLogs.performedOn,
        sessions: sql<number>`count(*)`.mapWith(Number),
        minutes: sql<number>`coalesce(sum(${workoutLogs.durationMinutes}), 0)`.mapWith(Number),
        caloriesBurned: sql<number>`coalesce(sum(${workoutLogs.caloriesBurned}), 0)`.mapWith(
          Number,
        ),
      })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          gte(workoutLogs.performedOn, from),
          lte(workoutLogs.performedOn, to),
        ),
      )
      .groupBy(workoutLogs.performedOn)
      .orderBy(asc(workoutLogs.performedOn));

    return new Map(
      rows.map((row) => [
        row.date,
        {
          sessions: row.sessions,
          minutes: row.minutes,
          caloriesBurned: row.caloriesBurned,
        },
      ]),
    );
  }

  /**
   * The summary over a caller-specified window, defaulting to the trailing month
   * — a longer default than the day-by-day history, because "sessions this month"
   * is what the Fitness card actually shows.
   */
  async getSummaryFor(
    userId: string,
    query: WorkoutHistoryQueryDto,
  ): Promise<WorkoutSummaryView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const { from, to } = this.resolveRange({ ...query, days: query.days ?? SUMMARY_DAYS }, today);

    return this.getSummary(userId, from, to);
  }

  /** Headline training stats over a window — the Fitness card's three figures. */
  async getSummary(userId: string, from: string, to: string): Promise<WorkoutSummaryView> {
    const [totalsByDate, byType, streakDays] = await Promise.all([
      this.totalsByDate(userId, from, to),
      this.sessionsByType(userId, from, to),
      this.currentStreak(userId, to),
    ]);

    const totals = [...totalsByDate.values()].reduce<WorkoutTotals>(
      (acc, day) => ({
        sessions: acc.sessions + day.sessions,
        minutes: acc.minutes + day.minutes,
        caloriesBurned: acc.caloriesBurned + day.caloriesBurned,
      }),
      { ...EMPTY_WORKOUT_TOTALS },
    );

    return {
      from,
      to,
      totals,
      averageMinutes: totals.sessions > 0 ? Math.round(totals.minutes / totals.sessions) : 0,
      streakDays,
      activeDays: totalsByDate.size,
      byType,
    };
  }

  /** Sessions and minutes per workout type over a window, busiest first. */
  async sessionsByType(
    userId: string,
    from: string,
    to: string,
  ): Promise<WorkoutSummaryView['byType']> {
    const rows = await this.db
      .select({
        type: workoutLogs.type,
        sessions: sql<number>`count(*)`.mapWith(Number),
        minutes: sql<number>`coalesce(sum(${workoutLogs.durationMinutes}), 0)`.mapWith(Number),
      })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          gte(workoutLogs.performedOn, from),
          lte(workoutLogs.performedOn, to),
        ),
      )
      .groupBy(workoutLogs.type)
      .orderBy(desc(sql`count(*)`));

    return rows.map((row) => ({
      type: row.type,
      label: workoutTypeLabel(row.type),
      sessions: row.sessions,
      minutes: row.minutes,
    }));
  }

  /** All-time session count, for lifetime milestones ("50 workouts"). */
  async totalSessions(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ sessions: sql<number>`count(*)`.mapWith(Number) })
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId));

    return row?.sessions ?? 0;
  }

  /** All-time total minutes trained, for endurance milestones. */
  async totalMinutes(userId: string): Promise<number> {
    const [row] = await this.db
      .select({
        minutes: sql<number>`coalesce(sum(${workoutLogs.durationMinutes}), 0)`.mapWith(Number),
      })
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId));

    return row?.minutes ?? 0;
  }

  /**
   * Sessions started before {@link EARLY_WORKOUT_BEFORE_HOUR} in the user's own
   * time zone, all time — the "Early Bird" badge.
   *
   * The zone is applied inside the query rather than by pulling every session out
   * and inspecting it in JavaScript, so the count costs one round trip however
   * long the user's history is.
   */
  async countEarlyWorkouts(userId: string, timeZone: string): Promise<number> {
    const [row] = await this.db
      .select({
        sessions: sql<number>`count(*)`.mapWith(Number),
      })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          sql`extract(hour from (${workoutLogs.performedAt} at time zone ${timeZone})) < ${EARLY_WORKOUT_BEFORE_HOUR}`,
        ),
      );

    return row?.sessions ?? 0;
  }

  /** The set of days in `[from, to]` on which the user trained. */
  async trainedDatesBetween(userId: string, from: string, to: string): Promise<Set<string>> {
    const rows = await this.db
      .selectDistinct({ date: workoutLogs.performedOn })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          gte(workoutLogs.performedOn, from),
          lte(workoutLogs.performedOn, to),
        ),
      );

    return new Set(rows.map((row) => row.date));
  }

  /**
   * Consecutive days ending at `date` on which a session was logged.
   *
   * A day with nothing logged yet does not break the run: the count simply starts
   * from the day before, so an unfinished today never reads as a lost streak.
   */
  async currentStreak(userId: string, date: string): Promise<number> {
    const trained = await this.trainedDatesBetween(
      userId,
      addDays(date, -(STREAK_LOOKBACK_DAYS - 1)),
      date,
    );

    let cursor = trained.has(date) ? date : addDays(date, -1);
    let streak = 0;
    while (trained.has(cursor) && streak < STREAK_LOOKBACK_DAYS) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Translates an update DTO to column changes, re-estimating energy as needed. */
  private async toColumnChanges(
    userId: string,
    existing: WorkoutLog,
    dto: UpdateWorkoutLogDto,
    timeZone: string,
  ): Promise<Partial<NewWorkoutLog>> {
    const changes: Partial<NewWorkoutLog> = {};

    if (dto.type !== undefined) changes.type = dto.type;
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.durationMinutes !== undefined) changes.durationMinutes = dto.durationMinutes;
    if (dto.intensity !== undefined) changes.intensity = dto.intensity;
    if (dto.icon !== undefined) changes.icon = dto.icon;
    if (dto.accent !== undefined) changes.accent = dto.accent;
    if (dto.notes !== undefined) changes.notes = dto.notes.trim() || null;

    if (dto.performedAt !== undefined) {
      const performedAt = new Date(dto.performedAt);
      changes.performedAt = performedAt;
      // Moving the timestamp moves the training day with it, unless the caller
      // pinned the day explicitly in the same request.
      changes.performedOn = dto.date ?? toLocalDate(performedAt, timeZone);
    } else if (dto.date !== undefined) {
      changes.performedOn = dto.date;
    }

    // An explicit figure always wins. Otherwise a change to any input of the
    // estimate re-runs it, so an edited session never keeps an energy value that
    // belonged to its previous shape.
    if (dto.caloriesBurned !== undefined) {
      changes.caloriesBurned = dto.caloriesBurned;
    } else if (
      dto.type !== undefined ||
      dto.intensity !== undefined ||
      dto.durationMinutes !== undefined
    ) {
      changes.caloriesBurned = await this.estimate(
        userId,
        dto.type ?? existing.type,
        dto.intensity ?? existing.intensity,
        dto.durationMinutes ?? existing.durationMinutes,
      );
    }

    return changes;
  }

  private async estimate(
    userId: string,
    type: WorkoutLog['type'],
    intensity: WorkoutLog['intensity'],
    durationMinutes: number,
  ): Promise<number> {
    const profile = await this.profiles.findRawByUserId(userId);
    return estimateCaloriesBurned({
      type,
      intensity,
      durationMinutes,
      weightKg: profile ? Number(profile.weightKg) : null,
    });
  }

  /**
   * Re-syncs the mirrored workout figures on `daily_metrics` and drops the user's
   * cached analytics.
   *
   * Best-effort by design: the session itself is already committed, and a failure
   * to update a derived mirror must not fail the user's write. The next sync
   * converges it, and the diary remains the source of truth either way.
   */
  private async afterChange(userId: string, dates: string[]): Promise<void> {
    await this.cache.delByPrefix(CacheKeys.analyticsPrefix(userId));

    for (const date of new Set(dates)) {
      try {
        const totals = await this.totalsByDate(userId, date, date);
        const day = totals.get(date) ?? { ...EMPTY_WORKOUT_TOTALS };

        await this.dailyMetrics.upsert(userId, {
          date,
          workoutCompleted: day.sessions > 0,
          workoutMinutes: day.minutes,
        });
      } catch (error) {
        this.logger.warn(
          `Could not sync daily metrics for ${date}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  private async findOwned(userId: string, id: string): Promise<WorkoutLog> {
    const log = await this.db.query.workoutLogs.findFirst({
      where: and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)),
    });
    if (!log) {
      throw new NotFoundException(`No workout log found with id "${id}".`);
    }
    return log;
  }

  /** Resolves the requested window, defaulting to the last `days` up to today. */
  private resolveRange(
    query: WorkoutHistoryQueryDto,
    today: string,
  ): { from: string; to: string } {
    const to = query.to ?? today;
    if (query.from) {
      // A caller-supplied range is honoured, but still capped so one request can
      // never scan an unbounded slice of history.
      const earliest = addDays(to, -(MAX_HISTORY_DAYS - 1));
      return { from: query.from < earliest ? earliest : query.from, to };
    }
    const days = Math.min(query.days ?? DEFAULT_HISTORY_DAYS, MAX_HISTORY_DAYS);
    return { from: addDays(to, -(days - 1)), to };
  }
}
