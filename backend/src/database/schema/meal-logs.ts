import { relations } from 'drizzle-orm';
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { accentColorEnum, mealTypeEnum } from './enums';
import { foods } from './foods';
import { users } from './users';

/**
 * The food diary — one row per item the user logged. Backs "Recent Meals",
 * "Meal History" and every calorie/macro roll-up in the app.
 *
 * Nutrition is **snapshotted** onto the row rather than joined from `foods` at
 * read time. A diary entry is a historical record of what the user actually
 * ate: if the catalogue row is later corrected (or deleted), past days must not
 * silently change. `food_id` is kept as a soft link for provenance and is
 * nulled rather than cascaded when a catalogue entry disappears.
 *
 * `logged_at` is the exact instant, while `logged_on` is the **user's local
 * calendar day** — the two can disagree either side of midnight, and every
 * day-scoped query groups on `logged_on` so a diary day always matches what the
 * user saw on their own clock.
 */
export const mealLogs = pgTable(
  'meal_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Catalogue entry this was logged from; null for custom/manual entries. */
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),

    /** Name as shown in the diary, snapshotted at log time. */
    name: text('name').notNull(),
    mealType: mealTypeEnum('meal_type').notNull(),
    /** Portion multiplier applied to the catalogue serving. */
    servings: numeric('servings', { precision: 6, scale: 2 }).notNull().default('1'),

    /** Totals for the logged portion (catalogue values × servings). */
    calories: numeric('calories', { precision: 8, scale: 2 }).notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 7, scale: 2 }).notNull(),
    fiberG: numeric('fiber_g', { precision: 7, scale: 2 }).notNull().default('0'),

    /** Presentation, snapshotted so history renders identically forever. */
    icon: text('icon').notNull().default('silverware-fork-knife'),
    accent: accentColorEnum('accent').notNull().default('violet'),

    /** Exact instant the food was consumed/logged. */
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
    /** The user's local calendar day this entry belongs to (YYYY-MM-DD). */
    loggedOn: date('logged_on').notNull(),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Day view / daily roll-ups.
    index('meal_logs_user_day_idx').on(table.userId, table.loggedOn),
    // "Recent Meals" — newest first for the current user.
    index('meal_logs_user_logged_at_idx').on(table.userId, table.loggedAt.desc()),
    index('meal_logs_food_id_idx').on(table.foodId),
  ],
);

export const mealLogsRelations = relations(mealLogs, ({ one }) => ({
  user: one(users, {
    fields: [mealLogs.userId],
    references: [users.id],
  }),
  food: one(foods, {
    fields: [mealLogs.foodId],
    references: [foods.id],
  }),
}));

export type MealLog = typeof mealLogs.$inferSelect;
export type NewMealLog = typeof mealLogs.$inferInsert;
