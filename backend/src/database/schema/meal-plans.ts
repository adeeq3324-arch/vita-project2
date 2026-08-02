import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  generationStatusEnum,
  mealTypeEnum,
  nutritionSourceEnum,
  recipeDifficultyEnum,
} from './enums';
import { users } from './users';

/**
 * The measured figures a food database reports that a planner cannot honestly
 * estimate, for one serving of the dish.
 *
 * Kept apart from the macro columns because they mean something different: the
 * macros are what the plan is *built* from and every total is summed over, while
 * these are what the plan is *checked* against — the numbers a user with high
 * blood pressure or diabetes was told to watch. Every field is nullable because
 * a published recipe reports what it reports.
 */
export interface MealNutritionFacts {
  /** Grams. */
  saturatedFat: number | null;
  /** Grams. */
  sugar: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  potassiumMg: number | null;
}

/**
 * An AI-generated week of meals.
 *
 * The row is created up front in `idle` and filled in by a background worker, so
 * the client always has an id to poll from the instant it asks for a plan. The
 * calorie target the plan was built against is snapshotted here: targets move as
 * the user's profile changes, and a plan has to stay readable as a record of
 * what was actually suggested at the time.
 *
 * `week_start_date` is a calendar date in the user's own time zone, always the
 * Monday of the week, which is what makes one-plan-per-week enforceable in the
 * database rather than in application logic.
 */
export const mealPlans = pgTable(
  'meal_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Monday of the week this plan covers (YYYY-MM-DD, user-local). */
    weekStartDate: date('week_start_date').notNull(),
    status: generationStatusEnum('status').notNull().default('idle'),

    /** Daily calorie budget the plan was generated against. */
    calorieTarget: integer('calorie_target').notNull(),

    /** Populated when generation fails, so the client can explain why. */
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One plan per user per week — the uniqueness the generate endpoint relies
    // on to stay idempotent under repeated taps.
    uniqueIndex('meal_plans_user_week_key').on(table.userId, table.weekStartDate),
    index('meal_plans_user_created_idx').on(table.userId, table.createdAt.desc()),
  ],
);

/**
 * One suggested meal within a plan.
 *
 * Holds a dish and the numbers behind it — no recipe, no method, no ingredient
 * list. The plan answers "what should I eat this week, does it add up to my
 * targets, and why is this the right thing for me", and keeping the row to that
 * keeps generation fast and the payload small enough to render a whole week at
 * once.
 *
 * `reasoning` is stored per meal rather than derived on the client because it is
 * the one part of a plan the user cannot check for themselves: a dish that looks
 * arbitrary is a dish they will swap out, and the sentence that connects it to
 * their goal is what makes the plan followable.
 */
export const mealPlanItems = pgTable(
  'meal_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mealPlanId: uuid('meal_plan_id')
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),

    /** ISO-8601 weekday: 1 = Monday … 7 = Sunday. */
    dayOfWeek: smallint('day_of_week').notNull(),
    mealType: mealTypeEnum('meal_type').notNull(),

    /**
     * When to eat it, as 24-hour local wall-clock time ("07:30").
     *
     * A time and not a timestamp: it means "half seven wherever you are", so it
     * survives the user travelling and never needs a zone to be read. Empty on
     * plans generated before the planner was asked for timings, which the client
     * renders as a meal without a time rather than as one at midnight.
     */
    scheduledTime: text('scheduled_time').notNull().default(''),

    name: text('name').notNull(),
    calories: numeric('calories', { precision: 8, scale: 2 }).notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 7, scale: 2 }).notNull(),
    fiberG: numeric('fiber_g', { precision: 7, scale: 2 }).notNull().default('0'),

    /**
     * Whether the five figures above are the model's estimate or a measured
     * panel from a matched published recipe. See {@link nutritionSourceEnum} —
     * the client says which, and must never present a guess as a measurement.
     */
    nutritionSource: nutritionSourceEnum('nutrition_source').notNull().default('estimated'),

    /**
     * Saturated fat, sugar, sodium and the rest, for one serving. Null whenever
     * nothing was matched, which is the same case as `nutritionSource` being
     * `estimated` — nobody has weighed this dish, so there is nothing to report.
     */
    nutritionFacts: jsonb('nutrition_facts').$type<MealNutritionFacts>(),

    /** Why this dish suits this user's goal, in two or three sentences. */
    reasoning: text('reasoning').notNull().default(''),

    /**
     * Photograph of the dish. Null until an image pipeline fills it in — the
     * client renders a designed tile in its place rather than a broken frame, so
     * a missing photo is never a missing meal.
     */
    imageUrl: text('image_url'),

    /**
     * The published recipe this dish was matched to, in the food database's own
     * numbering. Kept so the method can be fetched later without searching for
     * the dish a second time and possibly landing on a different one — the photo
     * on the card and the recipe behind it are then certainly the same dish.
     */
    sourceRecipeId: integer('source_recipe_id'),
    /** Where that recipe was published, for attribution. */
    sourceUrl: text('source_url'),
    sourceName: text('source_name'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('meal_plan_items_plan_day_idx').on(table.mealPlanId, table.dayOfWeek)],
);

/** One line of a recipe's shopping list: what to buy, and how much of it. */
export interface RecipeIngredient {
  /** The ingredient itself, e.g. "Chicken breast". */
  name: string;
  /** How much the recipe needs, with its unit, e.g. "200 g", "2 tbsp". */
  quantity: string;
  /** Optional preparation note shown beside it, e.g. "finely diced". */
  note?: string;
}

/** One numbered step of a method. */
export interface RecipeStep {
  /** What the step achieves, e.g. "Sear the chicken". */
  title: string;
  /** How to do it, in full. */
  instruction: string;
  /** Roughly how long it takes, or null when it is not a timed step. */
  minutes: number | null;
}

/**
 * The recipe behind one planned meal.
 *
 * Deliberately not part of `meal_plan_items`. A plan answers "what should I eat
 * this week and does it add up"; a recipe answers "how do I actually cook this",
 * and generating fifty-six of those up front would multiply the cost and the
 * latency of every plan for the handful a user opens. So this row is written the
 * first time someone asks to cook a dish, and read from then on — the meal keeps
 * its own lifecycle, and the recipe keeps its own.
 *
 * One recipe per meal, enforced by the unique index: two concurrent taps on
 * "View Recipe" must not produce two different methods for the same dish, and
 * the second writer losing the race is the correct outcome rather than an error.
 * Deleting the meal deletes the recipe, and a swapped meal has its recipe
 * removed explicitly — a method for a dish that is no longer on the plan is
 * worse than no method at all.
 */
export const mealRecipes = pgTable(
  'meal_recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mealPlanItemId: uuid('meal_plan_item_id')
      .notNull()
      .references(() => mealPlanItems.id, { onDelete: 'cascade' }),

    /** What the dish is and what it tastes like, in two or three sentences. */
    summary: text('summary').notNull(),
    /** Culinary tradition it belongs to, e.g. "Mediterranean". */
    cuisine: text('cuisine').notNull().default(''),
    difficulty: recipeDifficultyEnum('difficulty').notNull().default('easy'),

    /**
     * How many the method as written feeds. Stored because the plan's nutrition
     * is one person's portion while a method is rarely written for one — the
     * client cannot reconcile the two without knowing which it is looking at.
     */
    servings: integer('servings').notNull().default(1),
    /** Hands-on time before cooking starts, in minutes. */
    prepMinutes: integer('prep_minutes').notNull().default(0),
    /** Time on the heat, in minutes. Zero for a no-cook dish. */
    cookMinutes: integer('cook_minutes').notNull().default(0),

    /**
     * The shopping list. JSON rather than parallel arrays for the same reason a
     * supplement's facts panel is: a name and its quantity are one fact, and two
     * arrays that fall out of step put "200 g" against the wrong ingredient.
     */
    ingredients: jsonb('ingredients')
      .$type<RecipeIngredient[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /**
     * The method, in order. Each step carries its own title and duration so the
     * client can render a followable checklist rather than a wall of prose — the
     * difference between a recipe you read and a recipe you cook from.
     */
    steps: jsonb('steps')
      .$type<RecipeStep[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** Short pieces of practical advice: substitutions, storage, what to watch. */
    tips: text('tips').array().notNull().default([]),

    /**
     * Where the method came from, when it was published rather than generated.
     *
     * Null on a recipe the model wrote, and that is exactly how the client tells
     * the two apart: a real cook's recipe is credited to them, and one the model
     * assembled is not credited to anybody.
     */
    sourceUrl: text('source_url'),
    sourceName: text('source_name'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('meal_recipes_item_key').on(table.mealPlanItemId)],
);

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [mealPlans.userId],
    references: [users.id],
  }),
  items: many(mealPlanItems),
}));

export const mealPlanItemsRelations = relations(mealPlanItems, ({ one }) => ({
  plan: one(mealPlans, {
    fields: [mealPlanItems.mealPlanId],
    references: [mealPlans.id],
  }),
  recipe: one(mealRecipes, {
    fields: [mealPlanItems.id],
    references: [mealRecipes.mealPlanItemId],
  }),
}));

export const mealRecipesRelations = relations(mealRecipes, ({ one }) => ({
  meal: one(mealPlanItems, {
    fields: [mealRecipes.mealPlanItemId],
    references: [mealPlanItems.id],
  }),
}));

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;
export type MealPlanItem = typeof mealPlanItems.$inferSelect;
export type NewMealPlanItem = typeof mealPlanItems.$inferInsert;
export type MealRecipe = typeof mealRecipes.$inferSelect;
export type NewMealRecipe = typeof mealRecipes.$inferInsert;

/** The `idle → generating → ready | failed` lifecycle shared by generated artefacts. */
export type GenerationStatus = MealPlan['status'];
