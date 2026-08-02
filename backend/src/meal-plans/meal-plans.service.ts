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
import {
  mealPlanItems,
  mealPlans,
  mealRecipes,
  type MealPlan,
  type MealPlanItem,
  type MealRecipe,
  type NewMealPlanItem,
  type NewMealRecipe,
} from '../database/schema';
import { ProfilesService } from '../profiles/profiles.service';
import {
  JOB_GENERATE_MEAL_PLAN,
  QUEUE_MEAL_PLAN,
  type GenerationJobData,
} from '../queue/queue.constants';
import { SpoonacularService } from '../spoonacular/spoonacular.service';
import type { DishMatch, SourcedRecipe } from '../spoonacular/spoonacular.types';
import {
  buildMealPlanPrompt,
  buildMealSwapPrompt,
  mealPlanGenerationSchema,
  mealSwapSchema,
  MEAL_PLAN_SYSTEM_PROMPT,
  type GeneratedMealItem,
} from './meal-plan.schema';
import {
  toMealItemView,
  toMealPlanStatusView,
  toMealPlanView,
  type MealPlanItemView,
  type MealPlanStatusView,
  type MealPlanView,
} from './meal-plan.view';
import {
  buildMealRecipePrompt,
  mealRecipeSchema,
  MEAL_RECIPE_SYSTEM_PROMPT,
} from './meal-recipe.schema';
import { toMealRecipeView, type MealRecipeView } from './meal-recipe.view';

/**
 * Ceiling on generated length — a full week of meals is a large JSON document,
 * and each one now carries its own rationale as well as its nutrition.
 */
const MEAL_PLAN_MAX_TOKENS = 12_288;

/** One dish and one short explanation needs a fraction of a week's room. */
const MEAL_SWAP_MAX_TOKENS = 1024;

/**
 * A full method — a shopping list, up to a dozen written steps and the tips —
 * is the largest single-item generation the platform makes. Sized so a long
 * recipe finishes rather than being truncated into an unfollowable one.
 */
const MEAL_RECIPE_MAX_TOKENS = 4096;

/**
 * How much of a dish's name a published title must account for before the match
 * is used at all — for the photograph, and for the recipe behind it.
 *
 * A photograph on its own would justify a loose threshold; the recipe does not.
 * The same match supplies both, so accepting "Greek Yogurt Chicken Salad" for
 * "Greek yogurt with berries" — a real result at 0.67 — does not merely put an
 * odd picture on a card, it hands the user chicken salad when they tap "View
 * Recipe" on their breakfast.
 *
 * Set where measurement put the boundary between matches that are the dish and
 * matches that merely share words with it. The cost is meals that keep their
 * designed tile, which the screens are built for; the alternative cost is a plan
 * that quietly tells people to cook the wrong food.
 */
const IMAGE_MATCH_CONFIDENCE = 0.7;

/**
 * …and how much before that recipe's *numbers* are allowed to replace the
 * model's.
 *
 * Much stricter, because this is not decoration. Rewriting a meal's macros
 * against the wrong dish would put a measured-looking sodium figure in front of
 * someone managing their blood pressure that belongs to food they are not
 * eating, which is worse than the honest estimate it replaced.
 */
const NUTRITION_MATCH_CONFIDENCE = 0.8;

/**
 * How far a published serving may be scaled to reach the planned portion.
 *
 * A matched recipe's panel is per *its* serving, which is rarely the portion
 * this user was planned. Scaling by the calorie ratio is what makes the two
 * comparable — the dish's real macro *composition* at this user's *amount*.
 * Outside these bounds the recipe is not a portion of the planned meal at all,
 * it is a different dish that happens to share a name, and its numbers are
 * discarded.
 */
const MIN_PORTION_FACTOR = 0.4;
const MAX_PORTION_FACTOR = 2.5;

/**
 * Dish lookups made at once during enrichment.
 *
 * Held low: the upstream quota is metered daily and its rate limit is per
 * second, so a week of meals fired off in parallel would spend the budget on
 * 429s. Four keeps a full week's enrichment to a few seconds without ever
 * looking like a burst.
 */
const LOOKUP_CONCURRENCY = 4;

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
    private readonly foodDatabase: SpoonacularService,
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
    return this.withItems(await this.findOwned(userId, mealPlanId));
  }

  /**
   * This week's plan. Creates nothing — a week with no plan is a 404.
   *
   * This is what the client calls on open, so a returning user sees the plan
   * they already have rather than an invitation to generate one they are about
   * to be given for free.
   */
  async getCurrent(userId: string): Promise<MealPlanView> {
    const timeZone = await this.profiles.getTimeZone(userId);
    const plan = await this.findForWeek(userId, startOfWeek(todayIn(timeZone)));

    if (!plan) {
      throw new NotFoundException('No meal plan for this week yet. Generate one first.');
    }
    return this.withItems(plan);
  }

  /** One meal from a plan, for the detail screen and for deep links into it. */
  async getItem(
    userId: string,
    mealPlanId: string,
    itemId: string,
  ): Promise<MealPlanItemView> {
    await this.findOwned(userId, mealPlanId);
    return toMealItemView(await this.findItem(mealPlanId, itemId));
  }

  /**
   * Replaces one meal with a different dish of equivalent nutrition.
   *
   * Runs inline rather than through the queue: it is a single short generation
   * the user is actively waiting on, and handing it to a worker would trade a
   * couple of seconds of latency for a polling loop and a spinner with nothing
   * to show. The plan's own status is deliberately untouched — one meal being
   * exchanged does not put the whole week back into `generating`, which would
   * blank a screen the user is looking at.
   */
  async swapMeal(
    userId: string,
    mealPlanId: string,
    itemId: string,
  ): Promise<MealPlanItemView> {
    const plan = await this.findOwned(userId, mealPlanId);
    const current = await this.findItem(plan.id, itemId);
    const context = await this.userContext.build(userId);

    const siblings = await this.db.query.mealPlanItems.findMany({
      where: eq(mealPlanItems.mealPlanId, plan.id),
      columns: { id: true, name: true },
    });

    const generated = await this.ai.generateStructured(
      buildMealSwapPrompt(
        context,
        {
          mealType: current.mealType,
          name: current.name,
          calories: Number(current.calories),
          protein: Number(current.proteinG),
          carbs: Number(current.carbsG),
          fat: Number(current.fatG),
          fiber: Number(current.fiberG),
        },
        siblings.map((item) => item.name),
      ),
      mealSwapSchema,
      {
        system: MEAL_PLAN_SYSTEM_PROMPT,
        temperature: 0.8,
        maxOutputTokens: MEAL_SWAP_MAX_TOKENS,
      },
    );

    // The row is reused rather than replaced, so anything derived from the old
    // dish has to go with it in the same transaction: a method for a meal that
    // is no longer on the plan is worse than no method at all. `scheduledTime`
    // is the one thing deliberately kept — a swap changes what is eaten, not the
    // shape of the user's day.
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(mealPlanItems)
        .set({
          name: generated.name.trim(),
          calories: generated.calories.toFixed(2),
          proteinG: generated.protein.toFixed(2),
          carbsG: generated.carbs.toFixed(2),
          fatG: generated.fat.toFixed(2),
          fiberG: generated.fiber.toFixed(2),
          reasoning: generated.reasoning.trim(),
          // The photograph, the measured panel and the attribution all belonged
          // to the dish that was just replaced. Until the new one is matched,
          // these numbers are the model's again and must say so.
          imageUrl: null,
          nutritionSource: 'estimated',
          nutritionFacts: null,
          sourceRecipeId: null,
          sourceUrl: null,
          sourceName: null,
        })
        .where(eq(mealPlanItems.id, current.id))
        .returning();

      await tx.delete(mealRecipes).where(eq(mealRecipes.mealPlanItemId, current.id));
      return row;
    });

    if (!updated) {
      throw new NotFoundException('Meal not found.');
    }

    // The user is holding this screen open waiting for the replacement, so the
    // lookup is made now rather than left for a background pass: a swap that
    // resolved to a card with no photograph would read as a worse dish rather
    // than as a plan that had not caught up yet.
    await this.enrich([updated]);

    this.logger.log(`Swapped meal ${current.id} in plan ${plan.id}`);
    return toMealItemView(await this.findItem(plan.id, updated.id));
  }

  /**
   * The recipe for one planned meal: how to cook it, what to buy, how long it
   * takes.
   *
   * A dish matched to a published recipe when the plan was generated is cooked
   * from *that* method, not from a written one. It is a recipe somebody has
   * actually made, its quantities are real, and it is the same dish as the
   * photograph on the card — the model is the fallback for dishes nothing was
   * found for, and for matches that turned out to carry no method.
   *
   * Written once and read from then on. A week holds up to fifty-six dishes and
   * a user opens a handful of them, so generating every method up front would
   * multiply the cost and the wait of every plan for work almost all of which is
   * thrown away. The first person to ask for a dish pays a few seconds; everyone
   * after that — including them, on every later visit — is served from the row.
   *
   * Runs inline for the same reason a swap does: it is one short generation the
   * user is actively waiting on, and a queue would trade a couple of seconds for
   * a polling loop and a spinner with nothing behind it.
   */
  async getRecipe(
    userId: string,
    mealPlanId: string,
    itemId: string,
  ): Promise<MealRecipeView> {
    const plan = await this.findOwned(userId, mealPlanId);
    const meal = await this.findItem(plan.id, itemId);

    const existing = await this.findRecipe(meal.id);
    if (existing) {
      return toMealRecipeView(meal, existing);
    }

    const published = await this.findPublishedRecipe(meal);
    if (published) {
      return this.saveRecipe(meal, this.toSourcedRecipeRow(meal.id, published));
    }

    const context = await this.userContext.build(userId);

    const generated = await this.ai.generateStructured(
      buildMealRecipePrompt(context, {
        name: meal.name,
        mealType: meal.mealType,
        calories: Number(meal.calories),
        protein: Number(meal.proteinG),
        carbs: Number(meal.carbsG),
        fat: Number(meal.fatG),
        fiber: Number(meal.fiberG),
      }),
      mealRecipeSchema,
      {
        system: MEAL_RECIPE_SYSTEM_PROMPT,
        // Lower than a swap: a swap is asked for variety, a method is asked for
        // accuracy, and an inventive recipe is a wrong one.
        temperature: 0.5,
        maxOutputTokens: MEAL_RECIPE_MAX_TOKENS,
      },
    );

    this.logger.log(`Generated recipe for meal ${meal.id} in plan ${plan.id}`);

    return this.saveRecipe(meal, {
      mealPlanItemId: meal.id,
      summary: generated.summary.trim(),
      cuisine: generated.cuisine.trim(),
      difficulty: generated.difficulty,
      servings: generated.servings,
      prepMinutes: generated.prepMinutes,
      cookMinutes: generated.cookMinutes,
      ingredients: generated.ingredients.map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: ingredient.quantity.trim(),
        ...(ingredient.note?.trim() ? { note: ingredient.note.trim() } : {}),
      })),
      steps: generated.steps.map((step) => ({
        title: step.title.trim(),
        instruction: step.instruction.trim(),
        minutes: step.minutes > 0 ? step.minutes : null,
      })),
      tips: generated.tips.map((tip) => tip.trim()),
      // Nobody published this one, so it is credited to nobody.
      sourceUrl: null,
      sourceName: null,
    });
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

    const inserted = await this.db.insert(mealPlanItems).values(rows).returning();
    this.logger.log(`Generated ${inserted.length} meals for plan ${plan.id}`);

    await this.enrich(inserted);

    return plan.id;
  }

  // ── enrichment ────────────────────────────────────────────────────────────

  /**
   * Attaches what the model could not know to a set of freshly written meals.
   *
   * The generator names dishes and times them; it has never photographed or
   * weighed one. This is the step that goes and finds out: a photograph of the
   * dish, the measured macro composition of a published recipe for it, and a
   * pointer back to that recipe so the method can be fetched later without
   * searching again and possibly landing on a different dish.
   *
   * Entirely best-effort, and deliberately so. It runs *after* the meals are
   * committed, and every failure inside it is swallowed: a plan that generated
   * correctly must not be marked failed because a third-party food API was
   * having a bad minute. The worst outcome here is the plan the user would have
   * had anyway — the model's estimates, and a designed tile where a photo would
   * have gone.
   */
  private async enrich(items: readonly MealPlanItem[]): Promise<void> {
    if (!this.foodDatabase.enabled || items.length === 0) {
      return;
    }

    try {
      // A week repeats dishes, and the same name must not be searched twice.
      // Grouping first also means the lookup budget is spent on *distinct*
      // dishes rather than exhausted by a porridge that appears on four days.
      const byDish = new Map<string, MealPlanItem[]>();
      for (const item of items) {
        const key = item.name.trim().toLowerCase();
        const group = byDish.get(key);
        if (group) {
          group.push(item);
        } else {
          byDish.set(key, [item]);
        }
      }

      const groups = [...byDish.values()].slice(0, this.foodDatabase.maxLookupsPerPlan);
      let enriched = 0;

      await this.inBatches(groups, LOOKUP_CONCURRENCY, async (group) => {
        const match = await this.foodDatabase.matchDish(group[0].name);
        // Below the bar the meal keeps its designed tile and the model's own
        // estimate, which is the plan the user would have had anyway. See
        // IMAGE_MATCH_CONFIDENCE on why a near-miss is worse than nothing.
        if (!match || match.confidence < IMAGE_MATCH_CONFIDENCE) {
          return;
        }

        // Every meal sharing the name shares the match. The nutrition is
        // recomputed per meal even so: two days may plan the same dish at
        // different portions, and each has to be scaled to its own.
        for (const item of group) {
          await this.applyMatch(item, match);
          enriched += 1;
        }
      });

      if (enriched > 0) {
        this.logger.log(`Matched ${enriched}/${items.length} meals to published dishes`);
      }
    } catch (error) {
      this.logger.warn(
        `Meal enrichment did not complete: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Writes one matched dish onto one meal row. */
  private async applyMatch(item: MealPlanItem, match: DishMatch): Promise<void> {
    const nutrition = this.toVerifiedNutrition(item, match);

    await this.db
      .update(mealPlanItems)
      .set({
        imageUrl: match.imageUrl,
        sourceRecipeId: match.recipeId,
        sourceUrl: match.sourceUrl,
        sourceName: match.sourceName,
        ...nutrition,
      })
      .where(eq(mealPlanItems.id, item.id));
  }

  /**
   * Recasts a meal's nutrition against the published recipe it matched.
   *
   * The planned calories are kept exactly as they were, and the macros are the
   * matched dish's own composition scaled to reach them. That combination is the
   * point: the *shape* of the meal — how much of it is protein, how much fat,
   * how much sugar — stops being a guess and becomes a measurement, while the
   * day still adds up to the budget every other screen in the app computes
   * against. Replacing the calories instead would make the dish honest and the
   * week wrong.
   *
   * Returns nothing to change when the match is not close enough to act on, or
   * when the published serving is so far from the planned portion that scaling
   * it would be arithmetic rather than nutrition.
   */
  private toVerifiedNutrition(
    item: MealPlanItem,
    match: DishMatch,
  ): Partial<NewMealPlanItem> {
    const measured = match.nutrition;
    if (!measured || match.confidence < NUTRITION_MATCH_CONFIDENCE) {
      return {};
    }

    const planned = Number(item.calories);
    if (!Number.isFinite(planned) || planned <= 0) {
      return {};
    }

    const factor = planned / measured.calories;
    if (factor < MIN_PORTION_FACTOR || factor > MAX_PORTION_FACTOR) {
      return {};
    }

    const scale = (value: number | null): number | null =>
      value === null ? null : Math.round(value * factor * 10) / 10;

    return {
      proteinG: (measured.protein * factor).toFixed(2),
      carbsG: (measured.carbs * factor).toFixed(2),
      fatG: (measured.fat * factor).toFixed(2),
      fiberG: (measured.fiber * factor).toFixed(2),
      nutritionSource: 'verified',
      nutritionFacts: {
        saturatedFat: scale(measured.saturatedFat),
        sugar: scale(measured.sugar),
        sodiumMg: scale(measured.sodiumMg),
        cholesterolMg: scale(measured.cholesterolMg),
        potassiumMg: scale(measured.potassiumMg),
      },
    };
  }

  /**
   * Runs `work` over `values` a fixed number at a time.
   *
   * Not `Promise.all`: fifty-six simultaneous lookups against a per-second rate
   * limit is a burst of 429s rather than a fast plan. Not a sequential loop
   * either, which would make a cold week take a minute. One failure does not
   * stop the rest — each unit already handles its own.
   */
  private async inBatches<T>(
    values: readonly T[],
    size: number,
    work: (value: T) => Promise<void>,
  ): Promise<void> {
    for (let offset = 0; offset < values.length; offset += size) {
      await Promise.all(
        values.slice(offset, offset + size).map(async (value) => {
          try {
            await work(value);
          } catch (error) {
            this.logger.warn(
              `Enriching one meal failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }),
      );
    }
  }

  /**
   * Turns a published method into a recipe row for one meal.
   *
   * Difficulty is derived here rather than taken from the source, which does not
   * report it: the two things that actually make a weeknight recipe daunting are
   * how many moves it has and how long it holds the kitchen, so those are what
   * the three bands are drawn on.
   */
  private toSourcedRecipeRow(mealId: string, sourced: SourcedRecipe) {
    const totalMinutes = sourced.prepMinutes + sourced.cookMinutes;
    const difficulty =
      sourced.steps.length <= 5 && totalMinutes <= 30
        ? ('easy' as const)
        : sourced.steps.length >= 12 || totalMinutes >= 90
          ? ('hard' as const)
          : ('medium' as const);

    return {
      mealPlanItemId: mealId,
      summary: sourced.summary,
      cuisine: sourced.cuisine,
      difficulty,
      servings: sourced.servings,
      prepMinutes: sourced.prepMinutes,
      cookMinutes: sourced.cookMinutes,
      ingredients: sourced.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        ...(ingredient.note ? { note: ingredient.note } : {}),
      })),
      steps: sourced.steps,
      tips: sourced.tips,
      sourceUrl: sourced.sourceUrl,
      sourceName: sourced.sourceName,
    };
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

  private async withItems(plan: MealPlan): Promise<MealPlanView> {
    const items = await this.db.query.mealPlanItems.findMany({
      where: eq(mealPlanItems.mealPlanId, plan.id),
      orderBy: [asc(mealPlanItems.dayOfWeek)],
    });

    return toMealPlanView(plan, items);
  }

  private async findForWeek(userId: string, weekStartDate: string): Promise<MealPlan | undefined> {
    return this.db.query.mealPlans.findFirst({
      where: and(eq(mealPlans.userId, userId), eq(mealPlans.weekStartDate, weekStartDate)),
    });
  }

  /**
   * One meal, scoped to a plan the caller was already proven to own. The plan id
   * is part of the lookup rather than checked afterwards, so an item id from
   * someone else's plan simply does not match.
   */
  private async findItem(mealPlanId: string, itemId: string): Promise<MealPlanItem> {
    const item = await this.db.query.mealPlanItems.findFirst({
      where: and(eq(mealPlanItems.id, itemId), eq(mealPlanItems.mealPlanId, mealPlanId)),
    });

    if (!item) {
      throw new NotFoundException('Meal not found.');
    }
    return item;
  }

  /** The stored method for a meal, or undefined when nobody has asked for it yet. */
  private async findRecipe(mealPlanItemId: string): Promise<MealRecipe | undefined> {
    return this.db.query.mealRecipes.findFirst({
      where: eq(mealRecipes.mealPlanItemId, mealPlanItemId),
    });
  }

  /**
   * The published method for a meal, when the dish was matched to one.
   *
   * The recipe is fetched by the id recorded at generation time rather than by
   * searching for the dish again: a second search could easily land on a
   * different recipe, and a method that does not match the photograph above it
   * is a screen that contradicts itself.
   */
  private async findPublishedRecipe(meal: MealPlanItem): Promise<SourcedRecipe | null> {
    if (meal.sourceRecipeId === null) {
      return null;
    }
    return this.foodDatabase.getRecipe(meal.sourceRecipeId);
  }

  /**
   * Stores a method for a meal and returns it, whoever wrote it.
   *
   * Two taps on "View Recipe" can both miss the read that precedes this and both
   * produce a recipe. The unique index settles it: the loser keeps its own work
   * to itself and reads back the one that landed, so a dish never ends up with
   * two different methods depending on who asked first.
   */
  private async saveRecipe(
    meal: MealPlanItem,
    values: NewMealRecipe,
  ): Promise<MealRecipeView> {
    const [inserted] = await this.db
      .insert(mealRecipes)
      .values(values)
      .onConflictDoNothing({ target: mealRecipes.mealPlanItemId })
      .returning();

    if (inserted) {
      return toMealRecipeView(meal, inserted);
    }

    const winner = await this.findRecipe(meal.id);
    if (!winner) {
      throw new Error('The recipe could not be saved. Please try again.');
    }
    return toMealRecipeView(meal, winner);
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
        scheduledTime: item.time,
        name: item.name.trim(),
        calories: item.calories.toFixed(2),
        proteinG: item.protein.toFixed(2),
        carbsG: item.carbs.toFixed(2),
        fatG: item.fat.toFixed(2),
        fiberG: item.fiber.toFixed(2),
        reasoning: item.reasoning.trim(),
      }));
  }
}
