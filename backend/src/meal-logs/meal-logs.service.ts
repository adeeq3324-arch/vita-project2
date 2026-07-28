import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  addDays,
  dayLabel,
  localHour,
  toLocalDate,
  todayIn,
} from '../common/util/date.util';
import { DRIZZLE, type Database } from '../database/database.constants';
import { mealLogs, type MealLog, type NewMealLog } from '../database/schema';
import { FoodsService } from '../foods/foods.service';
import { ProfilesService } from '../profiles/profiles.service';
import type { CreateMealLogDto } from './dto/create-meal-log.dto';
import {
  DEFAULT_HISTORY_DAYS,
  DEFAULT_RECENT_LIMIT,
  MAX_HISTORY_DAYS,
  MAX_RECENT_LIMIT,
  type MealHistoryQueryDto,
} from './dto/query-meal-logs.dto';
import type { UpdateMealLogDto } from './dto/update-meal-log.dto';
import {
  EMPTY_TOTALS,
  sumTotals,
  toMealLogView,
  type MacroTotals,
  type MealHistoryDayView,
  type MealLogDayView,
  type MealLogView,
} from './meal-log.view';

/** Per-day aggregate straight from Postgres, before any presentation. */
export interface DailyIntake {
  date: string;
  totals: MacroTotals;
  mealCount: number;
}

/** Hour boundaries used to infer which sitting an entry belongs to. */
const MEAL_TYPE_BY_HOUR = [
  { until: 11, type: 'breakfast' },
  { until: 16, type: 'lunch' },
  { until: 21, type: 'dinner' },
] as const;

/**
 * The food diary. Every query is scoped to the caller's `user_id`, so a user can
 * only ever read or mutate their own entries — the application-level guarantee
 * that sits in front of the database's RLS policies.
 *
 * Nutrition is snapshotted onto each row at write time rather than joined from
 * the catalogue on read, so a later correction to a food never rewrites history.
 * Re-scaling an entry (changing `servings`) therefore works from the stored
 * values, keeping the entry a faithful record of what the user logged.
 */
@Injectable()
export class MealLogsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly foods: FoodsService,
    private readonly profiles: ProfilesService,
  ) {}

  async create(userId: string, dto: CreateMealLogDto): Promise<MealLogView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const loggedAt = dto.loggedAt ? new Date(dto.loggedAt) : new Date();
    const loggedOn = dto.date ?? toLocalDate(loggedAt, timeZone);
    const servings = dto.servings ?? 1;

    const nutrition = dto.foodId
      ? await this.fromCatalogue(dto, dto.foodId, servings)
      : this.fromCustomEntry(dto, servings);

    const values: NewMealLog = {
      userId,
      ...nutrition,
      servings: servings.toString(),
      mealType: dto.mealType ?? this.inferMealType(loggedAt, timeZone),
      loggedAt,
      loggedOn,
      notes: dto.notes?.trim() || null,
    };

    const [created] = await this.db.insert(mealLogs).values(values).returning();
    return toMealLogView(created, timeZone, todayIn(timeZone));
  }

  /** One diary day: its entries newest-first, plus the totals for the donut chart. */
  async getDay(userId: string, date?: string): Promise<MealLogDayView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const day = date ?? today;

    const rows = await this.db
      .select()
      .from(mealLogs)
      .where(and(eq(mealLogs.userId, userId), eq(mealLogs.loggedOn, day)))
      .orderBy(desc(mealLogs.loggedAt));

    const meals = rows.map((row) => toMealLogView(row, timeZone, today));

    return {
      date: day,
      dayLabel: dayLabel(day, today),
      totals: sumTotals(meals),
      mealCount: meals.length,
      meals,
    };
  }

  /**
   * "Recent Meals" — the newest entries across all days, used as quick-add
   * suggestions. Deliberately not de-duplicated by name: the list doubles as the
   * user's most recent activity, and repeats there are meaningful.
   */
  async getRecent(userId: string, limit?: number): Promise<MealLogView[]> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const take = Math.min(limit ?? DEFAULT_RECENT_LIMIT, MAX_RECENT_LIMIT);

    const rows = await this.db
      .select()
      .from(mealLogs)
      .where(eq(mealLogs.userId, userId))
      .orderBy(desc(mealLogs.loggedAt))
      .limit(take);

    return rows.map((row) => toMealLogView(row, timeZone, today));
  }

  /**
   * "Meal History" — one roll-up per day over the requested window, newest day
   * first. Days with no entries are included as zero rows so the client can
   * render an unbroken series without filling gaps itself.
   */
  async getHistory(userId: string, query: MealHistoryQueryDto): Promise<MealHistoryDayView[]> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const today = todayIn(timeZone);
    const { from, to } = this.resolveRange(query, today);

    const intake = await this.intakeByDate(userId, from, to);

    const days: MealHistoryDayView[] = [];
    for (let day = to; day >= from; day = addDays(day, -1)) {
      const entry = intake.get(day);
      days.push({
        date: day,
        dayLabel: dayLabel(day, today),
        totals: entry?.totals ?? EMPTY_TOTALS,
        mealCount: entry?.mealCount ?? 0,
      });
    }
    return days;
  }

  async getById(userId: string, id: string): Promise<MealLogView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const log = await this.findOwned(userId, id);
    return toMealLogView(log, timeZone, todayIn(timeZone));
  }

  async update(userId: string, id: string, dto: UpdateMealLogDto): Promise<MealLogView> {
    const existing = await this.findOwned(userId, id);
    const timeZone = await this.profiles.getTimeZone(userId);

    const changes = this.toColumnChanges(existing, dto, timeZone);

    if (Object.keys(changes).length === 0) {
      return toMealLogView(existing, timeZone, todayIn(timeZone));
    }

    const [updated] = await this.db
      .update(mealLogs)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(mealLogs.id, id), eq(mealLogs.userId, userId)))
      .returning();

    return toMealLogView(updated, timeZone, todayIn(timeZone));
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(mealLogs)
      .where(and(eq(mealLogs.id, id), eq(mealLogs.userId, userId)))
      .returning({ id: mealLogs.id });

    if (deleted.length === 0) {
      throw new NotFoundException(`No meal log found with id "${id}".`);
    }
  }

  /**
   * Per-day intake totals across a date range, aggregated in Postgres. Shared by
   * meal history, the daily-metrics health score and the home feed, so all three
   * read the same numbers from the same query.
   */
  async intakeByDate(userId: string, from: string, to: string): Promise<Map<string, DailyIntake>> {
    const rows = await this.db
      .select({
        date: mealLogs.loggedOn,
        kcal: sql<number>`coalesce(sum(${mealLogs.calories}), 0)`.mapWith(Number),
        protein: sql<number>`coalesce(sum(${mealLogs.proteinG}), 0)`.mapWith(Number),
        carbs: sql<number>`coalesce(sum(${mealLogs.carbsG}), 0)`.mapWith(Number),
        fat: sql<number>`coalesce(sum(${mealLogs.fatG}), 0)`.mapWith(Number),
        fiber: sql<number>`coalesce(sum(${mealLogs.fiberG}), 0)`.mapWith(Number),
        mealCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(mealLogs)
      .where(
        and(eq(mealLogs.userId, userId), gte(mealLogs.loggedOn, from), lte(mealLogs.loggedOn, to)),
      )
      .groupBy(mealLogs.loggedOn)
      .orderBy(asc(mealLogs.loggedOn));

    return new Map(
      rows.map((row) => [
        row.date,
        {
          date: row.date,
          mealCount: row.mealCount,
          totals: {
            kcal: Math.round(row.kcal),
            protein: Math.round(row.protein),
            carbs: Math.round(row.carbs),
            fat: Math.round(row.fat),
            fiber: Math.round(row.fiber),
          },
        },
      ]),
    );
  }

  /** Intake for a single day, zeroed when nothing was logged. */
  async intakeForDate(userId: string, date: string): Promise<DailyIntake> {
    const byDate = await this.intakeByDate(userId, date, date);
    return byDate.get(date) ?? { date, totals: EMPTY_TOTALS, mealCount: 0 };
  }

  /**
   * The set of days in `[from, to]` on which the user logged anything. Used to
   * work out logging streaks without pulling the diary itself.
   */
  async loggedDatesSince(userId: string, from: string, to: string): Promise<Set<string>> {
    const rows = await this.db
      .selectDistinct({ date: mealLogs.loggedOn })
      .from(mealLogs)
      .where(
        and(eq(mealLogs.userId, userId), gte(mealLogs.loggedOn, from), lte(mealLogs.loggedOn, to)),
      );

    return new Set(rows.map((row) => row.date));
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Nutrition for a catalogue-backed entry, scaled to the logged portion. */
  private async fromCatalogue(
    dto: CreateMealLogDto,
    foodId: string,
    servings: number,
  ): Promise<Pick<NewMealLog, 'foodId' | 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'icon' | 'accent'>> {
    // Throws 404 when the id is unknown, so a bad reference never becomes a row.
    const food = await this.foods.getById(foodId);

    return {
      foodId: food.id,
      name: dto.name?.trim() || food.name,
      calories: this.scale(food.kcal, servings),
      proteinG: this.scale(food.protein, servings),
      carbsG: this.scale(food.carbs, servings),
      fatG: this.scale(food.fat, servings),
      fiberG: this.scale(dto.fiber ?? food.fiber, servings),
      icon: dto.icon ?? food.icon,
      accent: dto.accent ?? food.accent,
    };
  }

  /**
   * Nutrition for a custom entry. The supplied macros are treated as *per
   * serving* and scaled, so `servings` behaves identically whichever way the
   * entry was created (the Add Custom Meal sheet sends totals with no servings,
   * which scales by 1 and is therefore unchanged).
   */
  private fromCustomEntry(
    dto: CreateMealLogDto,
    servings: number,
  ): Pick<NewMealLog, 'foodId' | 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'icon' | 'accent'> {
    return {
      foodId: null,
      // Presence is guaranteed by the DTO's conditional validation.
      name: (dto.name ?? '').trim(),
      calories: this.scale(dto.kcal ?? 0, servings),
      proteinG: this.scale(dto.protein ?? 0, servings),
      carbsG: this.scale(dto.carbs ?? 0, servings),
      fatG: this.scale(dto.fat ?? 0, servings),
      fiberG: this.scale(dto.fiber ?? 0, servings),
      icon: dto.icon ?? 'silverware-fork-knife',
      accent: dto.accent ?? 'violet',
    };
  }

  /**
   * Translates an update DTO to column changes.
   *
   * A change to `servings` re-scales the stored nutrition by the ratio between
   * the old and new portion; explicit macro values in the same request are
   * applied afterwards and therefore win.
   */
  private toColumnChanges(
    existing: MealLog,
    dto: UpdateMealLogDto,
    timeZone: string,
  ): Partial<NewMealLog> {
    const changes: Partial<NewMealLog> = {};

    if (dto.servings !== undefined) {
      changes.servings = dto.servings.toString();

      const previous = Number(existing.servings);
      // Guard against a zero/corrupt stored portion producing a divide by zero.
      if (previous > 0 && dto.servings !== previous) {
        const ratio = dto.servings / previous;
        changes.calories = this.scale(Number(existing.calories), ratio);
        changes.proteinG = this.scale(Number(existing.proteinG), ratio);
        changes.carbsG = this.scale(Number(existing.carbsG), ratio);
        changes.fatG = this.scale(Number(existing.fatG), ratio);
        changes.fiberG = this.scale(Number(existing.fiberG), ratio);
      }
    }

    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.kcal !== undefined) changes.calories = dto.kcal.toString();
    if (dto.protein !== undefined) changes.proteinG = dto.protein.toString();
    if (dto.carbs !== undefined) changes.carbsG = dto.carbs.toString();
    if (dto.fat !== undefined) changes.fatG = dto.fat.toString();
    if (dto.fiber !== undefined) changes.fiberG = dto.fiber.toString();
    if (dto.mealType !== undefined) changes.mealType = dto.mealType;
    if (dto.icon !== undefined) changes.icon = dto.icon;
    if (dto.accent !== undefined) changes.accent = dto.accent;
    if (dto.notes !== undefined) changes.notes = dto.notes.trim() || null;

    if (dto.loggedAt !== undefined) {
      const loggedAt = new Date(dto.loggedAt);
      changes.loggedAt = loggedAt;
      // Moving the timestamp moves the diary day with it, unless the caller
      // pinned the day explicitly in the same request.
      changes.loggedOn = dto.date ?? toLocalDate(loggedAt, timeZone);
    } else if (dto.date !== undefined) {
      changes.loggedOn = dto.date;
    }

    return changes;
  }

  private async findOwned(userId: string, id: string): Promise<MealLog> {
    const log = await this.db.query.mealLogs.findFirst({
      where: and(eq(mealLogs.id, id), eq(mealLogs.userId, userId)),
    });
    if (!log) {
      throw new NotFoundException(`No meal log found with id "${id}".`);
    }
    return log;
  }

  /** Resolves the requested window, defaulting to the last `days` up to today. */
  private resolveRange(query: MealHistoryQueryDto, today: string): { from: string; to: string } {
    const to = query.to ?? today;
    if (query.from) {
      // A caller-supplied range is honoured, but still capped so one request
      // can never scan an unbounded slice of history.
      const earliest = addDays(to, -(MAX_HISTORY_DAYS - 1));
      return { from: query.from < earliest ? earliest : query.from, to };
    }
    const days = Math.min(query.days ?? DEFAULT_HISTORY_DAYS, MAX_HISTORY_DAYS);
    return { from: addDays(to, -(days - 1)), to };
  }

  private inferMealType(instant: Date, timeZone: string): MealLog['mealType'] {
    const hour = localHour(instant, timeZone);
    return MEAL_TYPE_BY_HOUR.find((window) => hour < window.until)?.type ?? 'snack';
  }

  /** Scales a value by a portion and renders it for a `numeric` column. */
  private scale(value: number, factor: number): string {
    return (Math.round(value * factor * 100) / 100).toString();
  }
}
