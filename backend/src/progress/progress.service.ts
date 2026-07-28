import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { AchievementsService } from '../achievements/achievements.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  averageDefined,
  averageOver,
  isLoggedDay,
  sumOver,
  trailingStreak,
  type AnalyticsWindow,
  type DailySeriesPoint,
} from '../analytics/daily-series';
import { bmiBand, buildWeightJourney, calculateBmi } from '../analytics/weight';
import { CacheKeys, CacheTtl } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import {
  addDays,
  endOfMonth,
  resolveTimeZone,
  startOfMonth,
  startOfWeek,
  todayIn,
} from '../common/util/date.util';
import { healthScoreCaption } from '../daily-metrics/health-score';
import { DRIZZLE, type Database } from '../database/database.constants';
import {
  progressSnapshots,
  type NewProgressSnapshot,
  type ProgressSnapshot,
  type SnapshotPeriod,
} from '../database/schema';
import { ProfilesService } from '../profiles/profiles.service';
import {
  DEFAULT_SNAPSHOT_LIMIT,
  MAX_SNAPSHOT_LIMIT,
  type ProgressSnapshotsQueryDto,
} from './dto/query-progress.dto';
import type { RecordSnapshotDto } from './dto/record-snapshot.dto';
import {
  toProgressSnapshotView,
  type ProgressSnapshotView,
} from './progress-snapshot.view';
import {
  buildIntakeSeries,
  buildWeightSeries,
  buildWorkoutSeries,
  MONTH_WEIGHT_SERIES_POINTS,
  sparseLabels,
  weekBucketLabels,
} from './progress.charts';
import type {
  BodyStatView,
  FitnessStatsView,
  MacroLegendView,
  ProgressChartsView,
  ProgressHealthScoreView,
  ProgressOverviewView,
} from './progress.view';

/**
 * Days each Progress segment covers.
 *
 * A month is 28 days rather than 30 so that it divides cleanly into four weeks —
 * the frequency chart's "W1…W4" buckets are then genuine seven-day weeks rather
 * than seven-and-a-half-day approximations of one.
 */
const PERIOD_DAYS: Record<SnapshotPeriod, number> = { week: 7, month: 28 };

/** Axis labels the weekly and monthly charts show, matching the card widths. */
const WEEK_AXIS_LABELS = 4;
const MONTH_AXIS_LABELS = 3;

/**
 * How recently a user must have used the app to be swept into a scheduled
 * roll-up. Materialising history for accounts nobody opens is work spent on
 * nothing, and a returning user's periods are rolled up on demand the moment they
 * open the Progress tab.
 */
const ACTIVE_WITHIN_DAYS = 45;

/**
 * Progress analytics: the Progress tab, and the snapshot history behind it.
 *
 * Two distinct things live here, and the distinction is the point:
 *
 *  - **The overview is computed live** from a rolling window, because it must
 *    reflect the meal logged a minute ago. It is cached in Redis for a few minutes
 *    because it is the most expensive read in the app — a month of diaries,
 *    metrics and workouts joined into one payload — and dropped the instant
 *    anything that feeds it changes.
 *  - **Snapshots are calendar history**, keyed on the Monday or the 1st. They are
 *    the only home for user-reported body measurements, and they make long-range
 *    comparison two row reads instead of two months of re-aggregation.
 *
 * Neither owns a number the diaries already own: everything is composed from the
 * shared analytics window.
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly analytics: AnalyticsService,
    private readonly achievements: AchievementsService,
    private readonly profiles: ProfilesService,
    private readonly cache: CacheService,
  ) {}

  // ── the Progress tab ──────────────────────────────────────────────────────

  /**
   * The whole Progress tab for one segment.
   *
   * A window of *twice* the period is fetched, so the preceding period of equal
   * length is available for the "vs last week/month" comparisons without a second
   * round of queries and without depending on a snapshot having been rolled up.
   */
  async getOverview(userId: string, period: SnapshotPeriod): Promise<ProgressOverviewView> {
    const key = CacheKeys.progressOverview(userId, period);

    const cached = await this.cache.get<ProgressOverviewView>(key);
    if (cached) {
      return cached;
    }

    const days = PERIOD_DAYS[period];
    const window = await this.analytics.buildTrailingWindow(userId, days * 2);

    // `slice(-days)` is the current period; everything before it is the comparison.
    const current = window.days.slice(-days);
    const previous = window.days.slice(0, Math.max(0, window.days.length - days));

    const [{ badges, milestones }, bodyComposition] = await Promise.all([
      this.achievements.get(userId),
      this.latestBodyComposition(userId),
    ]);

    const view: ProgressOverviewView = {
      period,
      from: current[0]?.date ?? window.from,
      to: window.to,
      healthScore: this.buildHealthScore(period, current, previous),
      charts: this.buildCharts(period, window, current),
      bodyStats: this.buildBodyStats(window, current, bodyComposition),
      macros: this.buildMacros(current),
      fitnessStats: this.buildFitnessStats(period, window, current),
      achievements: badges,
      milestones,
    };

    await this.cache.set(key, view, CacheTtl.progressOverview);
    return view;
  }

  // ── snapshots ─────────────────────────────────────────────────────────────

  /** A user's stored roll-ups for one period type, newest first. */
  async listSnapshots(
    userId: string,
    query: ProgressSnapshotsQueryDto,
  ): Promise<ProgressSnapshotView[]> {
    const period = query.period ?? 'week';
    const limit = Math.min(query.limit ?? DEFAULT_SNAPSHOT_LIMIT, MAX_SNAPSHOT_LIMIT);

    return this.cache.getOrSet(
      CacheKeys.progressSnapshots(userId, period, limit),
      CacheTtl.progressSnapshots,
      async () => {
        const rows = await this.db
          .select()
          .from(progressSnapshots)
          .where(
            and(eq(progressSnapshots.userId, userId), eq(progressSnapshots.period, period)),
          )
          .orderBy(desc(progressSnapshots.periodStart))
          .limit(limit);

        return rows.map(toProgressSnapshotView);
      },
    );
  }

  /**
   * Rolls up a calendar period and records any body measurements sent with it.
   *
   * Idempotent, by way of the one-per-period unique index: submitting the same
   * period twice recomputes the aggregates in place rather than forking into two
   * versions of the same week.
   */
  async recordSnapshot(userId: string, dto: RecordSnapshotDto): Promise<ProgressSnapshotView> {
    const period = dto.period ?? 'week';
    const timeZone = await this.profiles.getTimeZone(userId);
    const anchor = dto.date ?? todayIn(timeZone);

    return this.rollUp(userId, period, anchor, {
      bodyFatPercent: dto.bodyFatPercent,
      muscleMassPercent: dto.muscleMassPercent,
      waistCm: dto.waistCm,
      chestCm: dto.chestCm,
      hipsCm: dto.hipsCm,
      armCm: dto.armCm,
      thighCm: dto.thighCm,
    });
  }

  /**
   * Computes and persists the roll-up for the period containing `anchor`.
   *
   * The aggregation range stops at today when the period is still running, so a
   * week in progress averages over the days that have actually happened. Without
   * that clamp, a Monday snapshot would divide three days of eating by seven and
   * report the user as barely eating at all.
   */
  async rollUp(
    userId: string,
    period: SnapshotPeriod,
    anchor: string,
    measurements: BodyMeasurements = {},
  ): Promise<ProgressSnapshotView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const { periodStart, periodEnd } = periodBounds(period, anchor);

    const aggregateTo = periodEnd > today ? today : periodEnd;
    const window = await this.analytics.buildRangeWindow(userId, periodStart, aggregateTo);

    const values: NewProgressSnapshot = {
      userId,
      period,
      periodStart,
      periodEnd,
      ...this.aggregate(window),
      ...toNumericStrings(measurements),
      computedAt: new Date(),
    };

    const [snapshot] = await this.db
      .insert(progressSnapshots)
      .values(values)
      .onConflictDoUpdate({
        target: [
          progressSnapshots.userId,
          progressSnapshots.period,
          progressSnapshots.periodStart,
        ],
        set: {
          periodEnd: sql`excluded.period_end`,
          weightStartKg: sql`excluded.weight_start_kg`,
          weightEndKg: sql`excluded.weight_end_kg`,
          weightDeltaKg: sql`excluded.weight_delta_kg`,
          bmi: sql`excluded.bmi`,
          avgCalories: sql`excluded.avg_calories`,
          avgProteinG: sql`excluded.avg_protein_g`,
          avgCarbsG: sql`excluded.avg_carbs_g`,
          avgFatG: sql`excluded.avg_fat_g`,
          avgFiberG: sql`excluded.avg_fiber_g`,
          avgWaterMl: sql`excluded.avg_water_ml`,
          avgSteps: sql`excluded.avg_steps`,
          workoutCount: sql`excluded.workout_count`,
          workoutMinutes: sql`excluded.workout_minutes`,
          workoutCaloriesBurned: sql`excluded.workout_calories_burned`,
          avgHealthScore: sql`excluded.avg_health_score`,
          daysLogged: sql`excluded.days_logged`,
          streakDays: sql`excluded.streak_days`,
          // Measurements are only ever *added* to. A roll-up that carries none must
          // not wipe the body-fat reading the user entered yesterday, which is what
          // makes the scheduled sweep safe to run over a period they have measured.
          bodyFatPercent: sql`coalesce(excluded.body_fat_percent, ${progressSnapshots.bodyFatPercent})`,
          muscleMassPercent: sql`coalesce(excluded.muscle_mass_percent, ${progressSnapshots.muscleMassPercent})`,
          waistCm: sql`coalesce(excluded.waist_cm, ${progressSnapshots.waistCm})`,
          chestCm: sql`coalesce(excluded.chest_cm, ${progressSnapshots.chestCm})`,
          hipsCm: sql`coalesce(excluded.hips_cm, ${progressSnapshots.hipsCm})`,
          armCm: sql`coalesce(excluded.arm_cm, ${progressSnapshots.armCm})`,
          thighCm: sql`coalesce(excluded.thigh_cm, ${progressSnapshots.thighCm})`,
          computedAt: sql`excluded.computed_at`,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Body measurements feed the Progress tab's measurement row, so the cached
    // overview is stale the moment one is recorded.
    await this.cache.delByPrefix(CacheKeys.analyticsPrefix(userId));

    return toProgressSnapshotView(snapshot);
  }

  /**
   * Rolls up the period that has just finished, for every active user.
   *
   * Driven by the scheduler and reusing the ordinary roll-up path, so a swept
   * snapshot is indistinguishable from one a user asked for. Failures are per-user
   * and swallowed: one account without a profile must not stop the sweep reaching
   * the rest.
   */
  async sweepCompletedPeriod(period: SnapshotPeriod): Promise<number> {
    const users = await this.findActiveUsers();
    this.logger.log(`${period} snapshot sweep: ${users.length} active users`);

    let rolled = 0;
    for (const user of users) {
      try {
        // Each user's period boundary is resolved in their own time zone. The sweep
        // fires at one instant, but that instant is not Monday everywhere — using
        // the server's week would roll up the wrong seven days for anyone whose
        // clock has not turned over yet.
        const today = todayIn(resolveTimeZone(user.timezone));
        const anchor =
          period === 'week' ? addDays(startOfWeek(today), -1) : addDays(startOfMonth(today), -1);

        await this.rollUp(user.userId, period, anchor);
        rolled += 1;
      } catch (error) {
        this.logger.warn(
          `Skipped ${user.userId} in the ${period} snapshot sweep: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    this.logger.log(`${period} snapshot sweep rolled up ${rolled} period(s)`);
    return rolled;
  }

  // ── aggregation ───────────────────────────────────────────────────────────

  /** Turns a window into the snapshot's computed columns. */
  private aggregate(window: AnalyticsWindow): Omit<
    NewProgressSnapshot,
    'userId' | 'period' | 'periodStart' | 'periodEnd' | 'computedAt'
  > {
    const days = window.days;
    const weightStart = window.weighIns[0]?.weightKg ?? null;
    const weightEnd = window.weighIns.at(-1)?.weightKg ?? null;
    const closingWeight =
      weightEnd ?? (window.profile ? Number(window.profile.weightKg) : null);
    const heightCm = window.profile ? Number(window.profile.heightCm) : null;

    const bmi =
      heightCm !== null && closingWeight !== null
        ? calculateBmi(heightCm, closingWeight)
        : null;

    const avgScore = averageDefined(days, (day) => day.healthScore);

    return {
      weightStartKg: toNumericString(weightStart),
      weightEndKg: toNumericString(weightEnd),
      weightDeltaKg:
        weightStart !== null && weightEnd !== null
          ? toNumericString(Math.round((weightEnd - weightStart) * 100) / 100)
          : null,
      bmi: toNumericString(bmi),

      avgCalories: round2(averageOver(days, (day) => day.intake.kcal)).toString(),
      avgProteinG: round2(averageOver(days, (day) => day.intake.protein)).toString(),
      avgCarbsG: round2(averageOver(days, (day) => day.intake.carbs)).toString(),
      avgFatG: round2(averageOver(days, (day) => day.intake.fat)).toString(),
      avgFiberG: round2(averageOver(days, (day) => day.intake.fiber)).toString(),
      avgWaterMl: Math.round(averageOver(days, (day) => day.waterMl)),
      avgSteps: Math.round(averageOver(days, (day) => day.steps)),

      workoutCount: sumOver(days, (day) => day.workouts.sessions),
      workoutMinutes: sumOver(days, (day) => day.workouts.minutes),
      workoutCaloriesBurned: sumOver(days, (day) => day.workouts.caloriesBurned),

      avgHealthScore: avgScore === null ? null : Math.round(avgScore),
      daysLogged: days.filter(isLoggedDay).length,
      streakDays: trailingStreak(days, isLoggedDay),
    };
  }

  // ── the overview's sections ───────────────────────────────────────────────

  private buildHealthScore(
    period: SnapshotPeriod,
    current: readonly DailySeriesPoint[],
    previous: readonly DailySeriesPoint[],
  ): ProgressHealthScoreView {
    const value = averageDefined(current, (day) => day.healthScore);
    const before = averageDefined(previous, (day) => day.healthScore);

    const score = value === null ? null : Math.round(value);
    const delta = value !== null && before !== null ? Math.round(value - before) : null;

    return {
      value: score,
      max: 100,
      caption: score === null ? null : healthScoreCaption(score),
      delta,
      vsLast: delta === null ? null : `${signed(delta)} vs last ${period}`,
    };
  }

  private buildCharts(
    period: SnapshotPeriod,
    window: AnalyticsWindow,
    current: readonly DailySeriesPoint[],
  ): ProgressChartsView {
    // The journey is measured over the current period only, so "-1.7 kg" is the
    // change this week rather than across the comparison window as well.
    const journey = buildWeightJourney(this.narrow(window, current));

    const weightPoints =
      period === 'week' ? current.length : Math.min(MONTH_WEIGHT_SERIES_POINTS, current.length);
    const weightData = buildWeightSeries(
      current,
      window.profile ? Number(window.profile.weightKg) : null,
      weightPoints,
    );

    const waterTargetMl = window.targets?.waterMl ?? current.at(-1)?.waterTargetMl ?? 0;
    const calorieTarget = window.targets?.calories ?? 0;
    const averageCalories = Math.round(averageOver(current, (day) => day.intake.kcal));

    return {
      weight: {
        data: weightData,
        labels: this.axisLabels(period, current, weightData.length),
        delta: `${signed(journey.deltaKg ?? 0, 1)} kg`,
        positive: journey.movingTowardTarget,
        unit: 'kg',
      },
      calories: {
        data: buildIntakeSeries(current, period, (day) => day.intake.kcal, Math.round),
        average: averageCalories.toLocaleString('en-US'),
        target: calorieTarget > 0 ? `${calorieTarget.toLocaleString('en-US')} kcal` : '—',
      },
      water: {
        data: buildIntakeSeries(current, period, (day) => day.waterMl, toLitres),
        today: `${toLitres(current.at(-1)?.waterMl ?? 0).toFixed(1)} L`,
        target: waterTargetMl > 0 ? `${trimZero(toLitres(waterTargetMl))} L` : '—',
      },
      workout: {
        data: buildWorkoutSeries(current, period),
        labels:
          period === 'week'
            ? this.axisLabels(period, current, current.length)
            : weekBucketLabels(current.length),
      },
    };
  }

  /**
   * Axis labels for a series drawn from `days`.
   *
   * Weekly charts label weekday names; monthly ones label calendar dates, which is
   * the only way "May 1 … May 28" reads unambiguously once weekday names would
   * repeat four times over.
   */
  private axisLabels(
    period: SnapshotPeriod,
    days: readonly DailySeriesPoint[],
    seriesLength: number,
  ): string[] {
    const count = period === 'week' ? WEEK_AXIS_LABELS : MONTH_AXIS_LABELS;
    const format = period === 'week' ? weekdayLabel : monthDayLabel;

    // The series may be shorter than the day list (a sampled monthly weight line),
    // so labels are mapped back onto the days they were sampled from.
    const step = seriesLength > 1 ? (days.length - 1) / (seriesLength - 1) : 0;

    return sparseLabels(seriesLength, count, (index) => {
      const day = days[Math.round(index * step)] ?? days.at(-1);
      return day ? format(day.date) : '';
    });
  }

  private buildBodyStats(
    window: AnalyticsWindow,
    current: readonly DailySeriesPoint[],
    composition: BodyCompositionRow | null,
  ): BodyStatView[] {
    const heightCm = window.profile ? Number(window.profile.heightCm) : null;
    const latestWeight =
      [...current].reverse().find((day) => day.weightKg !== null)?.weightKg ??
      (window.profile ? Number(window.profile.weightKg) : null);

    const bmi =
      heightCm !== null && latestWeight !== null ? calculateBmi(heightCm, latestWeight) : null;

    return [
      {
        key: 'bmi',
        label: 'BMI',
        value: bmi === null ? '—' : bmi.toFixed(1),
        unit: bmi === null ? 'unknown' : bmiBand(bmi),
        icon: 'human',
        available: bmi !== null,
      },
      {
        key: 'bodyfat',
        label: 'Body Fat',
        value: formatMeasurement(composition?.bodyFatPercent),
        unit: '%',
        icon: 'water-percent',
        available: composition?.bodyFatPercent != null,
      },
      {
        key: 'muscle',
        label: 'Muscle',
        value: formatMeasurement(composition?.muscleMassPercent),
        unit: '%',
        icon: 'arm-flex',
        available: composition?.muscleMassPercent != null,
      },
    ];
  }

  /**
   * The macro donut's legend: mean daily grams per macro, and each one's share of
   * the four macros' combined mass.
   *
   * A share of *mass*, not of energy — it is what the donut draws, and it is what
   * the mock legend's percentages added up to. An energy split would put fat at
   * roughly double these figures and would not match the ring beside it.
   */
  private buildMacros(current: readonly DailySeriesPoint[]): MacroLegendView[] {
    const grams = {
      protein: Math.round(averageOver(current, (day) => day.intake.protein)),
      carbs: Math.round(averageOver(current, (day) => day.intake.carbs)),
      fat: Math.round(averageOver(current, (day) => day.intake.fat)),
      fiber: Math.round(averageOver(current, (day) => day.intake.fiber)),
    };

    const total = grams.protein + grams.carbs + grams.fat + grams.fiber;
    const percentOf = (value: number): number =>
      total > 0 ? Math.round((value / total) * 100) : 0;

    return [
      { key: 'protein', label: 'Protein', metric: 'protein', grams: grams.protein, percent: percentOf(grams.protein) },
      { key: 'carbs', label: 'Carbs', metric: 'carbs', grams: grams.carbs, percent: percentOf(grams.carbs) },
      { key: 'fat', label: 'Fat', metric: 'fat', grams: grams.fat, percent: percentOf(grams.fat) },
      { key: 'fiber', label: 'Fiber', metric: 'fiber', grams: grams.fiber, percent: percentOf(grams.fiber) },
    ];
  }

  private buildFitnessStats(
    period: SnapshotPeriod,
    window: AnalyticsWindow,
    current: readonly DailySeriesPoint[],
  ): FitnessStatsView {
    const sessions = sumOver(current, (day) => day.workouts.sessions);
    const minutes = sumOver(current, (day) => day.workouts.minutes);

    // The streak is measured across the whole fetched window rather than the
    // displayed period: a seven-day segment would cap a genuine ten-day run at
    // seven, which reads as the app losing count.
    const streak = trailingStreak(window.days, (day) => day.workouts.sessions > 0);

    return {
      sessions: {
        label: 'Sessions',
        value: String(sessions),
        hint: `this ${period}`,
      },
      streak: {
        label: 'Streak',
        value: String(streak),
        hint: streak === 1 ? 'day in a row' : 'days in a row',
      },
      duration: {
        label: 'Avg time',
        value: sessions > 0 ? `${Math.round(minutes / sessions)}m` : '—',
        hint: 'per workout',
      },
    };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * A view of `window` restricted to `days`, with the weigh-ins narrowed to match.
   *
   * Needed because the fetched window intentionally spans two periods: anything
   * measuring "this period" has to see only its own half, weigh-ins included.
   */
  private narrow(window: AnalyticsWindow, days: readonly DailySeriesPoint[]): AnalyticsWindow {
    const from = days[0]?.date ?? window.from;
    const to = days.at(-1)?.date ?? window.to;

    return {
      ...window,
      from,
      to,
      days: [...days],
      weighIns: window.weighIns.filter((entry) => entry.date >= from && entry.date <= to),
    };
  }

  /**
   * The most recent body measurements the user recorded, from any period.
   *
   * Carried forward for display rather than copied onto each new snapshot: a waist
   * measurement from three weeks ago is the best available answer to "what is your
   * waist?", but writing it into this week's row would fabricate a measurement
   * that was never taken.
   */
  private async latestBodyComposition(userId: string): Promise<BodyCompositionRow | null> {
    const [row] = await this.db
      .select({
        bodyFatPercent: progressSnapshots.bodyFatPercent,
        muscleMassPercent: progressSnapshots.muscleMassPercent,
      })
      .from(progressSnapshots)
      .where(
        and(
          eq(progressSnapshots.userId, userId),
          or(
            isNotNull(progressSnapshots.bodyFatPercent),
            isNotNull(progressSnapshots.muscleMassPercent),
          ),
        ),
      )
      .orderBy(desc(progressSnapshots.periodStart))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      bodyFatPercent: row.bodyFatPercent === null ? null : Number(row.bodyFatPercent),
      muscleMassPercent:
        row.muscleMassPercent === null ? null : Number(row.muscleMassPercent),
    };
  }

  /**
   * Users worth rolling up for: onboarding complete, and something logged
   * recently. One query rather than a fetch-then-filter, so the sweep does not
   * pull the whole user table into memory as it grows.
   */
  private async findActiveUsers(): Promise<{ userId: string; timezone: string }[]> {
    const rows = await this.db.execute<{ user_id: string; timezone: string }>(sql`
      SELECT p.user_id, p.timezone
      FROM profiles p
      WHERE EXISTS (
              SELECT 1 FROM meal_logs m
              WHERE m.user_id = p.user_id
                AND m.logged_at > now() - ${`${ACTIVE_WITHIN_DAYS} days`}::interval
            )
         OR EXISTS (
              SELECT 1 FROM daily_metrics d
              WHERE d.user_id = p.user_id
                AND d.updated_at > now() - ${`${ACTIVE_WITHIN_DAYS} days`}::interval
            )
         OR EXISTS (
              SELECT 1 FROM workout_logs w
              WHERE w.user_id = p.user_id
                AND w.performed_at > now() - ${`${ACTIVE_WITHIN_DAYS} days`}::interval
            )
    `);

    return rows.map((row) => ({ userId: row.user_id, timezone: row.timezone }));
  }
}

/** The measurements a client may attach to a roll-up. */
export interface BodyMeasurements {
  bodyFatPercent?: number;
  muscleMassPercent?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
}

/** Columns each measurement maps to, so an omitted one stays out of the insert. */
type MeasurementColumns = Pick<
  ProgressSnapshot,
  'bodyFatPercent' | 'muscleMassPercent' | 'waistCm' | 'chestCm' | 'hipsCm' | 'armCm' | 'thighCm'
>;

/**
 * The calendar bounds of the period containing `anchor`.
 *
 * Weeks run Monday to Sunday and months from the 1st to the last day, matching the
 * keys `progress_snapshots` stores — so "this week" is one canonical range rather
 * than whichever seven days the user happened to open the app across.
 */
export function periodBounds(
  period: SnapshotPeriod,
  anchor: string,
): { periodStart: string; periodEnd: string } {
  if (period === 'month') {
    return { periodStart: startOfMonth(anchor), periodEnd: endOfMonth(anchor) };
  }
  const periodStart = startOfWeek(anchor);
  return { periodStart, periodEnd: addDays(periodStart, 6) };
}

/** Renders a number for a `numeric` column, preserving null. */
function toNumericString(value: number | null): string | null {
  return value === null ? null : value.toString();
}

/** Maps supplied measurements onto their columns; omitted ones become null. */
function toNumericStrings(measurements: BodyMeasurements): MeasurementColumns {
  return {
    bodyFatPercent: toNumericString(measurements.bodyFatPercent ?? null),
    muscleMassPercent: toNumericString(measurements.muscleMassPercent ?? null),
    waistCm: toNumericString(measurements.waistCm ?? null),
    chestCm: toNumericString(measurements.chestCm ?? null),
    hipsCm: toNumericString(measurements.hipsCm ?? null),
    armCm: toNumericString(measurements.armCm ?? null),
    thighCm: toNumericString(measurements.thighCm ?? null),
  };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Millilitres as litres to one decimal, the unit the hydration card shows. */
const toLitres = (millilitres: number): number => Math.round(millilitres / 100) / 10;

/** "3" rather than "3.0", so a whole-litre goal reads cleanly. */
const trimZero = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** "+6" / "-1.7" — a delta always carries its sign, including zero as "+0". */
function signed(value: number, decimals = 0): string {
  const rendered = decimals > 0 ? Math.abs(value).toFixed(decimals) : String(Math.abs(value));
  return `${value < 0 ? '-' : '+'}${rendered}`;
}

/** "18" / "—" for a measurement the user has never recorded. */
function formatMeasurement(value: number | null | undefined): string {
  return value == null ? '—' : String(Math.round(value));
}

/** "Mon" — the weekly charts' axis label. */
function weekdayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/** "May 1" — the monthly charts' axis label. */
function monthDayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** The two composition figures the measurement row reads. */
interface BodyCompositionRow {
  bodyFatPercent: number | null;
  muscleMassPercent: number | null;
}
