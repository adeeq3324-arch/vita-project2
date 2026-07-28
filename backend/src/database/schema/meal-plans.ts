import { relations } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { generationStatusEnum, mealTypeEnum } from './enums';
import { users } from './users';

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
 * Deliberately holds a name and its macros and nothing more — no recipe, no
 * method, no ingredient list. The plan answers "what should I eat this week and
 * does it add up to my targets", and keeping the row to that keeps generation
 * fast and the payload small enough to render a whole week at once.
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

    name: text('name').notNull(),
    calories: numeric('calories', { precision: 8, scale: 2 }).notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 7, scale: 2 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('meal_plan_items_plan_day_idx').on(table.mealPlanId, table.dayOfWeek)],
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
}));

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;
export type MealPlanItem = typeof mealPlanItems.$inferSelect;
export type NewMealPlanItem = typeof mealPlanItems.$inferInsert;

/** The `idle → generating → ready | failed` lifecycle shared by generated artefacts. */
export type GenerationStatus = MealPlan['status'];
