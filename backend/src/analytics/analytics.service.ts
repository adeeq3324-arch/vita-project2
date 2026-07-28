import { Injectable, NotFoundException } from '@nestjs/common';
import { addDays, eachDateInRange, todayIn } from '../common/util/date.util';
import { DailyMetricsService } from '../daily-metrics/daily-metrics.service';
import { GoalsService } from '../goals/goals.service';
import { EMPTY_TOTALS } from '../meal-logs/meal-log.view';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import type { NutritionTargetView } from '../nutrition-targets/nutrition-target.view';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { ProfilesService } from '../profiles/profiles.service';
import { EMPTY_WORKOUT_TOTALS } from '../workout-logs/workout-log.view';
import { WorkoutLogsService } from '../workout-logs/workout-logs.service';
import type { AnalyticsWindow, DailySeriesPoint } from './daily-series';

/**
 * The hardest ceiling in the analytics layer: no single window may span more than
 * this. It matches `daily_metrics`' own range limit, which is the narrowest of the
 * underlying queries — asking for more would silently return a shorter series.
 */
export const MAX_WINDOW_DAYS = 90;

/**
 * Assembles a window of daily history from every domain that tracks something.
 *
 * This is the one query fan-out behind the whole progress and engagement layer.
 * The Progress tab, the snapshot roll-ups and the achievement evaluator all read
 * a {@link AnalyticsWindow} rather than talking to the diaries themselves, which
 * buys three things:
 *
 *  - **One definition of a day.** Gap filling, time zones and what "logged"
 *    means are settled here, so a streak, a chart and a snapshot can never
 *    disagree about the same Tuesday.
 *  - **One round of queries.** Every source is fetched concurrently, so a
 *    90-day window costs roughly one round trip's latency rather than five.
 *  - **No duplicated ownership.** Nothing here recomputes intake, scores or
 *    training totals; it composes the services that own them.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly goals: GoalsService,
    private readonly targets: NutritionTargetsService,
    private readonly mealLogs: MealLogsService,
    private readonly dailyMetrics: DailyMetricsService,
    private readonly workouts: WorkoutLogsService,
  ) {}

  /** The window ending today, spanning `days` (capped at {@link MAX_WINDOW_DAYS}). */
  async buildTrailingWindow(userId: string, days: number): Promise<AnalyticsWindow> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const span = Math.max(1, Math.min(days, MAX_WINDOW_DAYS));

    return this.buildWindow(userId, addDays(today, -(span - 1)), today, timeZone, today);
  }

  /** The window covering an explicit `[from, to]` range. */
  async buildRangeWindow(userId: string, from: string, to: string): Promise<AnalyticsWindow> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);

    // A range longer than the ceiling is trimmed from its *start*: the recent end
    // is what every caller anchors on, so dropping the oldest days degrades the
    // answer far more gracefully than truncating the other way.
    const earliest = addDays(to, -(MAX_WINDOW_DAYS - 1));
    return this.buildWindow(userId, from < earliest ? earliest : from, to, timeZone, today);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async buildWindow(
    userId: string,
    from: string,
    to: string,
    timeZone: string,
    today: string,
  ): Promise<AnalyticsWindow> {
    const [profile, goal, targets, intake, metrics, workouts, weighIns] = await Promise.all([
      this.profiles.findRawByUserId(userId),
      this.goals.findRawByUserId(userId),
      this.tryGetTargets(userId),
      this.mealLogs.intakeByDate(userId, from, to),
      this.dailyMetrics.getRange(userId, { from, to }),
      this.workouts.totalsByDate(userId, from, to),
      this.dailyMetrics.weighIns(userId, from, to),
    ]);

    const metricsByDate = new Map(metrics.map((day) => [day.date, day]));

    const days: DailySeriesPoint[] = eachDateInRange(from, to).map((date) => {
      const day = metricsByDate.get(date);
      const dayIntake = intake.get(date);

      return {
        date,
        intake: dayIntake?.totals ?? EMPTY_TOTALS,
        mealCount: dayIntake?.mealCount ?? 0,
        waterMl: day?.waterMl ?? 0,
        waterTargetMl: day?.waterTargetMl ?? targets?.waterMl ?? 0,
        steps: day?.steps ?? 0,
        stepsTarget: day?.stepsTarget ?? 0,
        weightKg: day?.weightKg ?? null,
        workouts: workouts.get(date) ?? { ...EMPTY_WORKOUT_TOTALS },
        healthScore: day?.healthScore ?? null,
      };
    });

    return { from, to, timeZone, today, profile, goal, targets, days, weighIns };
  }

  /** Targets, or null when onboarding is incomplete — analytics still answer. */
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
}
