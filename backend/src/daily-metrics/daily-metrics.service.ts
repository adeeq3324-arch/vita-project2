import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import {
  addDays,
  dayLabel,
  eachDateInRange,
  resolveTimeZone,
  todayIn,
} from '../common/util/date.util';
import { CacheKeys } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import { dailyMetrics, type DailyMetric, type Profile } from '../database/schema';
import type { DailyIntake } from '../meal-logs/meal-logs.service';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import { EMPTY_TOTALS } from '../meal-logs/meal-log.view';
import type { NutritionTargetView } from '../nutrition-targets/nutrition-target.view';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  DEFAULT_STEPS_TARGET,
  DEFAULT_WATER_TARGET_ML,
  STEPS_TARGET,
} from './activity-targets';
import type { DailyMetricView } from './daily-metric.view';
import {
  DEFAULT_RANGE_DAYS,
  MAX_RANGE_DAYS,
  type DailyMetricsRangeQueryDto,
} from './dto/query-daily-metrics.dto';
import type { AddWaterDto, UpdateDailyMetricsDto } from './dto/update-daily-metrics.dto';
import { calculateHealthScore, healthScoreCaption } from './health-score';

/** Everything needed to score a day, gathered once and reused across a range. */
interface ScoringContext {
  timeZone: string;
  today: string;
  stepsTarget: number;
  targets: NutritionTargetView | null;
}

/**
 * Per-day movement, hydration, body weight and workout tracking, plus the
 * composite health score derived from them.
 *
 * The score is recomputed on every read rather than trusted from storage: it
 * depends on the day's meal logs and the user's targets, both of which can
 * change after the row was written. Where a row already exists and its stored
 * score has drifted, the fresh value is written back, so historical trends
 * converge on the truth without a background job.
 */
@Injectable()
export class DailyMetricsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly profiles: ProfilesService,
    private readonly mealLogs: MealLogsService,
    private readonly targets: NutritionTargetsService,
    private readonly cache: CacheService,
  ) {}

  async getDay(userId: string, date?: string): Promise<DailyMetricView> {
    const context = await this.buildContext(userId);
    const day = date ?? context.today;

    const [row, intake] = await Promise.all([
      this.findRow(userId, day),
      this.mealLogs.intakeForDate(userId, day),
    ]);

    return this.present(userId, day, row, intake, context);
  }

  /** A window of days for trend charts, ascending, with gaps filled as zero days. */
  async getRange(userId: string, query: DailyMetricsRangeQueryDto): Promise<DailyMetricView[]> {
    const context = await this.buildContext(userId);
    const { from, to } = this.resolveRange(query, context.today);

    const [rows, intake] = await Promise.all([
      this.db
        .select()
        .from(dailyMetrics)
        .where(
          and(
            eq(dailyMetrics.userId, userId),
            gte(dailyMetrics.date, from),
            lte(dailyMetrics.date, to),
          ),
        )
        .orderBy(asc(dailyMetrics.date)),
      this.mealLogs.intakeByDate(userId, from, to),
    ]);

    const rowsByDate = new Map(rows.map((row) => [row.date, row]));

    return Promise.all(
      eachDateInRange(from, to).map((day) =>
        this.present(
          userId,
          day,
          rowsByDate.get(day),
          intake.get(day) ?? { date: day, totals: EMPTY_TOTALS, mealCount: 0 },
          context,
        ),
      ),
    );
  }

  /** Writes the supplied metrics to a day, creating the row when it is the first. */
  async upsert(userId: string, dto: UpdateDailyMetricsDto): Promise<DailyMetricView> {
    const context = await this.buildContext(userId);
    const day = dto.date ?? context.today;

    const changes = {
      ...(dto.steps !== undefined ? { steps: dto.steps } : {}),
      ...(dto.waterMl !== undefined ? { waterMl: dto.waterMl } : {}),
      ...(dto.activeCalories !== undefined ? { activeCalories: dto.activeCalories } : {}),
      ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg.toString() } : {}),
      ...(dto.workoutCompleted !== undefined ? { workoutCompleted: dto.workoutCompleted } : {}),
      ...(dto.workoutMinutes !== undefined ? { workoutMinutes: dto.workoutMinutes } : {}),
    };

    const [row] = await this.db
      .insert(dailyMetrics)
      .values({ userId, date: day, ...changes })
      .onConflictDoUpdate({
        target: [dailyMetrics.userId, dailyMetrics.date],
        set: { ...changes, updatedAt: new Date() },
      })
      .returning();

    await this.invalidateAnalytics(userId);

    const intake = await this.mealLogs.intakeForDate(userId, day);
    return this.present(userId, day, row, intake, context);
  }

  /**
   * Adds to the day's fluid intake. The increment happens inside the statement
   * (`water_ml + n`, floored at zero) so two clients logging a glass at the same
   * moment both count, rather than one overwriting the other.
   */
  async addWater(userId: string, dto: AddWaterDto): Promise<DailyMetricView> {
    const context = await this.buildContext(userId);
    const day = dto.date ?? context.today;

    const [row] = await this.db
      .insert(dailyMetrics)
      .values({ userId, date: day, waterMl: Math.max(0, dto.amountMl) })
      .onConflictDoUpdate({
        target: [dailyMetrics.userId, dailyMetrics.date],
        set: {
          waterMl: sql`greatest(0, ${dailyMetrics.waterMl} + ${dto.amountMl})`,
          updatedAt: new Date(),
        },
      })
      .returning();

    await this.invalidateAnalytics(userId);

    const intake = await this.mealLogs.intakeForDate(userId, day);
    return this.present(userId, day, row, intake, context);
  }

  /**
   * Drops the caller's cached analytics after a metrics write.
   *
   * Weight, water, steps and workout minutes are all inputs to the Progress tab
   * and the achievement standing, both of which are cached for minutes. Without
   * this, a weigh-in does not show up on the progress chart until the TTL
   * expires — the user sees the number they just entered contradicted by their
   * own graph.
   */
  private async invalidateAnalytics(userId: string): Promise<void> {
    await this.cache.delByPrefix(CacheKeys.analyticsPrefix(userId));
  }

  /**
   * Every weigh-in in a window, ascending. Only days the user actually stepped
   * on the scales are returned, so callers can read the first and last entries
   * as genuine measurements rather than carried-forward values.
   */
  async weighIns(
    userId: string,
    from: string,
    to: string,
  ): Promise<{ date: string; weightKg: number }[]> {
    const rows = await this.db
      .select({ date: dailyMetrics.date, weightKg: dailyMetrics.weightKg })
      .from(dailyMetrics)
      .where(
        and(
          eq(dailyMetrics.userId, userId),
          gte(dailyMetrics.date, from),
          lte(dailyMetrics.date, to),
          isNotNull(dailyMetrics.weightKg),
        ),
      )
      .orderBy(asc(dailyMetrics.date));

    return rows.map((row) => ({ date: row.date, weightKg: Number(row.weightKg) }));
  }

  /**
   * Builds a day's view and refreshes its stored score when that has drifted.
   * Shared by every read and write path so the scoring rules live in one place.
   */
  private async present(
    userId: string,
    date: string,
    row: DailyMetric | undefined,
    intake: DailyIntake,
    context: ScoringContext,
  ): Promise<DailyMetricView> {
    const steps = row?.steps ?? 0;
    const waterMl = row?.waterMl ?? 0;
    const workoutCompleted = row?.workoutCompleted ?? false;

    const waterTargetMl = context.targets?.waterMl ?? DEFAULT_WATER_TARGET_ML;

    // Without targets (onboarding incomplete) there is nothing to score against.
    const score = context.targets
      ? calculateHealthScore({
          intake: intake.totals,
          mealCount: intake.mealCount,
          waterMl,
          steps,
          stepsTarget: context.stepsTarget,
          workoutCompleted,
          targets: context.targets,
        }).score
      : null;

    // Only rows that already exist are updated: a plain read of an untouched day
    // must not create one.
    if (row && score !== null && row.healthScore !== score) {
      await this.db
        .update(dailyMetrics)
        .set({ healthScore: score, updatedAt: new Date() })
        .where(and(eq(dailyMetrics.userId, userId), eq(dailyMetrics.date, date)));
    }

    return {
      date,
      dayLabel: dayLabel(date, context.today),
      steps,
      stepsTarget: context.stepsTarget,
      waterMl,
      waterTargetMl,
      activeCalories: row?.activeCalories ?? 0,
      weightKg: row?.weightKg === undefined || row.weightKg === null ? null : Number(row.weightKg),
      workoutCompleted,
      workoutMinutes: row?.workoutMinutes ?? 0,
      healthScore: score,
      healthScoreCaption: score === null ? null : healthScoreCaption(score),
    };
  }

  /**
   * Gathers the per-user context a day's presentation needs. Resolved once per
   * request so scoring a 90-day range still costs a single profile and target
   * lookup.
   */
  private async buildContext(userId: string): Promise<ScoringContext> {
    const [profile, targets] = await Promise.all([
      this.profiles.findRawByUserId(userId),
      this.tryGetTargets(userId),
    ]);

    const timeZone = this.timeZoneOf(profile);

    return {
      timeZone,
      today: todayIn(timeZone),
      stepsTarget: profile ? STEPS_TARGET[profile.activityLevel] : DEFAULT_STEPS_TARGET,
      targets,
    };
  }

  /**
   * Targets, or null when the user has not completed onboarding. Metrics
   * tracking must keep working before a profile exists — the day simply cannot
   * be scored yet.
   */
  private async tryGetTargets(userId: string): Promise<NutritionTargetView | null> {
    try {
      return await this.targets.get(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  private timeZoneOf(profile: Profile | undefined): string {
    return resolveTimeZone(profile?.timezone);
  }

  private async findRow(userId: string, date: string): Promise<DailyMetric | undefined> {
    return this.db.query.dailyMetrics.findFirst({
      where: and(eq(dailyMetrics.userId, userId), eq(dailyMetrics.date, date)),
    });
  }

  private resolveRange(
    query: DailyMetricsRangeQueryDto,
    today: string,
  ): { from: string; to: string } {
    const to = query.to ?? today;
    if (query.from) {
      const earliest = addDays(to, -(MAX_RANGE_DAYS - 1));
      return { from: query.from < earliest ? earliest : query.from, to };
    }
    const days = Math.min(query.days ?? DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS);
    return { from: addDays(to, -(days - 1)), to };
  }
}
