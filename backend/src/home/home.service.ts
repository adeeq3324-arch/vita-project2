import { Injectable, NotFoundException } from '@nestjs/common';
import { addDays, dayLabel, todayIn } from '../common/util/date.util';
import type { DailyMetricView } from '../daily-metrics/daily-metric.view';
import { DailyMetricsService } from '../daily-metrics/daily-metrics.service';
import type { Goal, Profile } from '../database/schema';
import { GoalsService } from '../goals/goals.service';
import type { DailyIntake } from '../meal-logs/meal-logs.service';
import { MealLogsService } from '../meal-logs/meal-logs.service';
import type { NutritionTargetView } from '../nutrition-targets/nutrition-target.view';
import { NutritionTargetsService } from '../nutrition-targets/nutrition-targets.service';
import { ProfilesService } from '../profiles/profiles.service';
import { DEFAULT_TREND_DAYS, MAX_TREND_DAYS, type HomeFeedQueryDto } from './dto/home-feed.dto';
import type {
  HomeActivityView,
  HomeFeedView,
  HomeHealthScoreView,
  HomeMetricView,
  HomeProgressView,
} from './home.view';

/** How far back to look for weigh-ins and logging streaks. */
const LOOKBACK_DAYS = 90;

/** Human-readable name for each goal, for the progress card. */
const GOAL_LABEL: Record<Goal['primaryGoal'], string> = {
  muscle_gain: 'Muscle Gain',
  weight_loss: 'Weight Loss',
  healthy_lifestyle: 'Healthy Lifestyle',
};

/**
 * Assembles the Home tab dashboard.
 *
 * A read-only aggregator: it owns no tables and duplicates no rules, composing
 * the profile, goal, nutrition targets, food diary and daily metrics into the
 * single payload the dashboard renders. Every underlying query is issued
 * concurrently, so the whole screen costs roughly one round trip's latency.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly goals: GoalsService,
    private readonly targets: NutritionTargetsService,
    private readonly mealLogs: MealLogsService,
    private readonly dailyMetrics: DailyMetricsService,
  ) {}

  async getFeed(userId: string, query: HomeFeedQueryDto): Promise<HomeFeedView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const date = query.date ?? today;

    const trendDays = Math.min(query.trendDays ?? DEFAULT_TREND_DAYS, MAX_TREND_DAYS);
    const trendFrom = addDays(date, -(trendDays - 1));
    const lookbackFrom = addDays(date, -(LOOKBACK_DAYS - 1));

    const [profile, goal, targets, intake, trend, weighIns, loggedDates] = await Promise.all([
      this.profiles.findRawByUserId(userId),
      this.goals.findRawByUserId(userId),
      this.tryGetTargets(userId),
      this.mealLogs.intakeForDate(userId, date),
      this.dailyMetrics.getRange(userId, { from: trendFrom, to: date }),
      this.dailyMetrics.weighIns(userId, lookbackFrom, date),
      this.mealLogs.loggedDatesSince(userId, lookbackFrom, date),
    ]);

    // `getRange` returns the window ascending, so the requested day is its last
    // entry. Falling back keeps the feed answerable for an out-of-range date.
    const day = trend.at(-1) ?? (await this.dailyMetrics.getDay(userId, date));
    const activities = this.buildActivities(intake, day, targets);

    return {
      date,
      dayLabel: dayLabel(date, today),
      name: this.firstName(profile),
      healthScore: this.buildHealthScore(trend),
      metrics: this.buildMetrics(intake, day, targets),
      activities,
      activitiesCompleted: activities.filter((activity) => activity.done).length,
      intake: {
        kcal: intake.totals.kcal,
        protein: intake.totals.protein,
        carbs: intake.totals.carbs,
        fat: intake.totals.fat,
        fiber: intake.totals.fiber,
        mealCount: intake.mealCount,
      },
      targets: targets
        ? {
            calories: targets.calories,
            protein: targets.protein,
            carbs: targets.carbs,
            fat: targets.fat,
            fiber: targets.fiber,
            waterMl: targets.waterMl,
            steps: day.stepsTarget,
            mealsPerDay: targets.mealsPerDay,
          }
        : null,
      progress: this.buildProgress(profile, goal, weighIns, loggedDates, date),
    };
  }

  // ── sections ──────────────────────────────────────────────────────────────

  /**
   * The score card: the day's value plus its trend, and how it compares to the
   * days before it in the same window.
   */
  private buildHealthScore(trend: DailyMetricView[]): HomeHealthScoreView {
    const current = trend.at(-1)?.healthScore ?? null;

    const earlier = trend.slice(0, -1).map((d) => d.healthScore).filter((s): s is number => s !== null);
    const average =
      earlier.length > 0 ? earlier.reduce((sum, score) => sum + score, 0) / earlier.length : null;

    return {
      value: current,
      max: 100,
      caption: trend.at(-1)?.healthScoreCaption ?? null,
      delta: current !== null && average !== null ? Math.round(current - average) : null,
      deltaLabel: `vs last ${trend.length - 1} days`,
      trend: trend.map((d) => d.healthScore),
      trendLabels: trend.map((d) => this.weekdayLabel(d.date)),
    };
  }

  /**
   * The six overview tiles. Keys, labels, icons and colour keys match the
   * design system's metric names, so the client maps each tile straight onto a
   * palette entry.
   */
  private buildMetrics(
    intake: DailyIntake,
    day: DailyMetricView,
    targets: NutritionTargetView | null,
  ): HomeMetricView[] {
    const tiles: Omit<HomeMetricView, 'progress'>[] = [
      { key: 'calories', label: 'Calories', icon: 'fire', metric: 'calories', value: intake.totals.kcal, target: targets?.calories ?? 0, unit: 'kcal', decimals: 0 },
      { key: 'protein', label: 'Protein', icon: 'food-drumstick', metric: 'protein', value: intake.totals.protein, target: targets?.protein ?? 0, unit: 'g', decimals: 0 },
      { key: 'carbs', label: 'Carbs', icon: 'bread-slice', metric: 'carbs', value: intake.totals.carbs, target: targets?.carbs ?? 0, unit: 'g', decimals: 0 },
      { key: 'fat', label: 'Fat', icon: 'water', metric: 'fat', value: intake.totals.fat, target: targets?.fat ?? 0, unit: 'g', decimals: 0 },
      { key: 'water', label: 'Water', icon: 'cup-water', metric: 'water', value: this.toLitres(day.waterMl), target: this.toLitres(day.waterTargetMl), unit: 'L', decimals: 1 },
      { key: 'steps', label: 'Steps', icon: 'shoe-print', metric: 'steps', value: day.steps, target: day.stepsTarget, unit: '', decimals: 0 },
    ];

    return tiles.map((tile) => ({
      ...tile,
      progress: tile.target > 0 ? Math.min(1, tile.value / tile.target) : 0,
    }));
  }

  /**
   * The activities checklist. Covers the four things Phase 2 can actually
   * measure; supplements and reminders join it when those features land.
   */
  private buildActivities(
    intake: DailyIntake,
    day: DailyMetricView,
    targets: NutritionTargetView | null,
  ): HomeActivityView[] {
    const mealsTarget = targets?.mealsPerDay ?? 0;

    return [
      {
        key: 'meals',
        label: 'Meals',
        detail: mealsTarget > 0
          ? `${intake.mealCount} of ${mealsTarget} logged`
          : `${intake.mealCount} logged`,
        icon: 'silverware-fork-knife',
        accent: 'red',
        done: mealsTarget > 0 ? intake.mealCount >= mealsTarget : intake.mealCount > 0,
      },
      {
        key: 'workout',
        label: 'Workout',
        detail: day.workoutCompleted
          ? `Completed · ${day.workoutMinutes} min`
          : 'Not logged yet',
        icon: 'dumbbell',
        accent: 'cyan',
        done: day.workoutCompleted,
      },
      {
        key: 'water',
        label: 'Water',
        detail: `${this.toLitres(day.waterMl).toFixed(1)} L of ${this.toLitres(day.waterTargetMl).toFixed(1)} L`,
        icon: 'cup-water',
        accent: 'green',
        done: day.waterTargetMl > 0 && day.waterMl >= day.waterTargetMl,
      },
      {
        key: 'steps',
        label: 'Steps',
        detail: `${this.formatCount(day.steps)} of ${this.formatCount(day.stepsTarget)}`,
        icon: 'shoe-print',
        accent: 'orange',
        done: day.stepsTarget > 0 && day.steps >= day.stepsTarget,
      },
    ];
  }

  /**
   * The progress card: weight movement against the goal, and the logging streak.
   *
   * The weight baseline is the earliest real weigh-in in the lookback window,
   * falling back to the profile weight captured at onboarding — so a user who
   * has never weighed in still sees a sensible starting point instead of a gap.
   */
  private buildProgress(
    profile: Profile | undefined,
    goal: Goal | undefined,
    weighIns: { date: string; weightKg: number }[],
    loggedDates: Set<string>,
    date: string,
  ): HomeProgressView {
    const profileWeight = profile ? Number(profile.weightKg) : null;
    const start = weighIns[0]?.weightKg ?? profileWeight;
    const current = weighIns.at(-1)?.weightKg ?? profileWeight;
    const target = goal?.targetWeightKg == null ? null : Number(goal.targetWeightKg);

    const delta =
      start !== null && current !== null ? Math.round((current - start) * 10) / 10 : null;

    return {
      weight: {
        current,
        start,
        target,
        delta,
        positive: this.isMovingTowardTarget(start, current, target, delta),
        unit: 'kg',
      },
      goal: {
        primaryGoal: goal?.primaryGoal ?? null,
        label: goal ? GOAL_LABEL[goal.primaryGoal] : 'Goal progress',
        percent: this.goalPercent(start, current, target),
      },
      streak: {
        label: 'Day streak',
        value: this.loggingStreak(loggedDates, date),
      },
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Progress from the starting weight toward the target, 0–100.
   *
   * Expressed as a signed ratio so it works identically for losing and gaining:
   * moving away from the target clamps to 0, reaching or passing it clamps to
   * 100. A start that already equals the target is complete by definition.
   */
  private goalPercent(
    start: number | null,
    current: number | null,
    target: number | null,
  ): number | null {
    if (start === null || current === null || target === null) {
      return null;
    }

    const distance = target - start;
    if (Math.abs(distance) < 0.05) {
      return 100;
    }

    const ratio = (current - start) / distance;
    return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  }

  private isMovingTowardTarget(
    start: number | null,
    current: number | null,
    target: number | null,
    delta: number | null,
  ): boolean {
    if (delta === null) {
      return false;
    }
    if (start === null || current === null || target === null) {
      // With no target to aim at, losing weight is the conventional default
      // reading of "progress" — and holding steady counts as holding ground.
      return delta <= 0;
    }
    if (delta === 0) {
      return true;
    }
    return (current - start) * (target - start) > 0;
  }

  /**
   * Consecutive days ending at `date` on which something was logged.
   *
   * When the current day has nothing logged yet the count starts from the day
   * before, so an unfinished today never reads as a broken streak.
   */
  private loggingStreak(loggedDates: Set<string>, date: string): number {
    let cursor = loggedDates.has(date) ? date : addDays(date, -1);
    let streak = 0;

    while (loggedDates.has(cursor) && streak < LOOKBACK_DAYS) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  /** Targets, or null when onboarding is incomplete — the feed still renders. */
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

  private firstName(profile: Profile | undefined): string {
    const name = profile?.name.trim() ?? '';
    return name.split(/\s+/)[0] || 'there';
  }

  private weekdayLabel(date: string): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  }

  private toLitres(millilitres: number): number {
    return Math.round(millilitres / 100) / 10;
  }

  private formatCount(value: number): string {
    return value.toLocaleString('en-US');
  }
}
