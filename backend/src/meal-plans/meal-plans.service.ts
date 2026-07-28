import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, asc, eq, ne } from 'drizzle-orm';
import { AI_SERVICE } from '../ai/ai.constants';
import { AiService } from '../ai/ai.interface';
import { UserContextService } from '../ai-context/user-context.service';
import { AiJobsService } from '../ai-jobs/ai-jobs.service';
import { startOfWeek, todayIn } from '../common/util/date.util';
import { DRIZZLE, type Database } from '../database/database.constants';
import { mealPlanItems, mealPlans, type MealPlan, type NewMealPlanItem } from '../database/schema';
import { ProfilesService } from '../profiles/profiles.service';
import {
  JOB_GENERATE_MEAL_PLAN,
  QUEUE_MEAL_PLAN,
  type GenerationJobData,
} from '../queue/queue.constants';
import {
  buildMealPlanPrompt,
  mealPlanGenerationSchema,
  MEAL_PLAN_SYSTEM_PROMPT,
  type GeneratedMealItem,
} from './meal-plan.schema';
import {
  toMealPlanStatusView,
  toMealPlanView,
  type MealPlanStatusView,
  type MealPlanView,
} from './meal-plan.view';

/** Ceiling on generated length — a full week of meals is a large JSON document. */
const MEAL_PLAN_MAX_TOKENS = 8192;

/**
 * Weekly AI meal plans.
 *
 * Generation never happens on the request thread. `generate` does the cheap,
 * synchronous part — resolve the week, validate that the user can be planned
 * for, reserve the row — and hands the expensive part to a worker, so the client
 * gets an id to poll in milliseconds rather than holding a connection open for
 * however long the model takes.
 */
@Injectable()
export class MealPlansService {
  private readonly logger = new Logger(MealPlansService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @InjectQueue(QUEUE_MEAL_PLAN) private readonly queue: Queue<GenerationJobData>,
    private readonly profiles: ProfilesService,
    private readonly userContext: UserContextService,
    private readonly aiJobs: AiJobsService,
  ) {}

  /**
   * Requests a plan for the current week and returns immediately.
   *
   * Re-requesting is safe. A generation already in flight is returned untouched
   * rather than duplicated; a finished or failed plan is regenerated in place,
   * which is what tapping "generate" again is asking for.
   */
  async generate(userId: string): Promise<MealPlanStatusView> {
    // Built first: it throws when onboarding is incomplete, and doing that
    // before any write means a rejected request leaves no half-made plan behind.
    const context = await this.userContext.build(userId);

    const timeZone = await this.profiles.getTimeZone(userId);
    const weekStartDate = startOfWeek(todayIn(timeZone));

    const plan = await this.reserve(userId, weekStartDate, context.targets.calories);

    // Reservation was declined: a worker is already generating this week.
    if (!plan) {
      const inFlight = await this.findForWeek(userId, weekStartDate);
      if (!inFlight) {
        throw new NotFoundException('The meal plan could not be found.');
      }
      return toMealPlanStatusView(inFlight);
    }

    // Any previous week's contents are gone the moment we commit to regenerating,
    // so a partially-replaced plan can never be served as if it were complete.
    await this.db.delete(mealPlanItems).where(eq(mealPlanItems.mealPlanId, plan.id));

    const job = await this.aiJobs.enqueue(userId, 'mealPlan');
    await this.queue.add(JOB_GENERATE_MEAL_PLAN, {
      aiJobId: job.id,
      userId,
      targetId: plan.id,
    });

    return toMealPlanStatusView(plan);
  }

  /** Poll target: the plan's lifecycle state and nothing else. */
  async getStatus(userId: string, mealPlanId: string): Promise<MealPlanStatusView> {
    return toMealPlanStatusView(await this.findOwned(userId, mealPlanId));
  }

  /** The full plan. Days are empty until generation completes. */
  async getById(userId: string, mealPlanId: string): Promise<MealPlanView> {
    const plan = await this.findOwned(userId, mealPlanId);
    const items = await this.db.query.mealPlanItems.findMany({
      where: eq(mealPlanItems.mealPlanId, plan.id),
      orderBy: [asc(mealPlanItems.dayOfWeek)],
    });

    return toMealPlanView(plan, items);
  }

  /**
   * The generation itself, called by the queue worker.
   *
   * Returns the plan id so the job ledger can record what the work produced.
   * Status transitions are not touched here — {@link AiJobsService.track} owns
   * those, which is what keeps the ledger and the plan row from disagreeing.
   */
  async runGeneration(userId: string, mealPlanId: string): Promise<string> {
    const plan = await this.findOwned(userId, mealPlanId);
    const context = await this.userContext.build(userId);

    const generated = await this.ai.generateStructured(
      buildMealPlanPrompt(context, plan.weekStartDate),
      mealPlanGenerationSchema,
      {
        system: MEAL_PLAN_SYSTEM_PROMPT,
        temperature: 0.4,
        maxOutputTokens: MEAL_PLAN_MAX_TOKENS,
      },
    );

    const rows = this.toRows(plan.id, generated.items);
    if (rows.length === 0) {
      throw new Error('The generated meal plan contained no usable meals.');
    }

    await this.db.insert(mealPlanItems).values(rows);
    this.logger.log(`Generated ${rows.length} meals for plan ${plan.id}`);

    return plan.id;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * Claims the week's plan row for a fresh generation, atomically.
   *
   * The conflict target is the one-plan-per-week unique index, and the guard on
   * the update is what makes concurrent requests safe: a row already in
   * `generating` fails the `setWhere` and no row comes back, so two taps in
   * quick succession cannot reset a plan a worker is midway through writing.
   */
  private async reserve(
    userId: string,
    weekStartDate: string,
    calorieTarget: number,
  ): Promise<MealPlan | undefined> {
    const [plan] = await this.db
      .insert(mealPlans)
      .values({ userId, weekStartDate, status: 'idle', calorieTarget })
      .onConflictDoUpdate({
        target: [mealPlans.userId, mealPlans.weekStartDate],
        set: {
          status: 'idle',
          calorieTarget,
          errorMessage: null,
          updatedAt: new Date(),
        },
        setWhere: ne(mealPlans.status, 'generating'),
      })
      .returning();

    return plan;
  }

  private async findForWeek(userId: string, weekStartDate: string): Promise<MealPlan | undefined> {
    return this.db.query.mealPlans.findFirst({
      where: and(eq(mealPlans.userId, userId), eq(mealPlans.weekStartDate, weekStartDate)),
    });
  }

  /** A plan belonging to the caller, or a 404 — never another user's row. */
  private async findOwned(userId: string, mealPlanId: string): Promise<MealPlan> {
    const plan = await this.db.query.mealPlans.findFirst({
      where: and(eq(mealPlans.id, mealPlanId), eq(mealPlans.userId, userId)),
    });

    if (!plan) {
      throw new NotFoundException('Meal plan not found.');
    }
    return plan;
  }

  /** Maps generated meals onto rows, dropping any that fall outside the week. */
  private toRows(mealPlanId: string, items: readonly GeneratedMealItem[]): NewMealPlanItem[] {
    return items
      .filter((item) => item.dayOfWeek >= 1 && item.dayOfWeek <= 7)
      .map((item) => ({
        mealPlanId,
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        name: item.name.trim(),
        calories: item.calories.toFixed(2),
        proteinG: item.protein.toFixed(2),
        carbsG: item.carbs.toFixed(2),
        fatG: item.fat.toFixed(2),
      }));
  }
}
