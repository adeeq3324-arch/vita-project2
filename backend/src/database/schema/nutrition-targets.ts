import { relations } from 'drizzle-orm';
import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { nutritionTargetSourceEnum } from './enums';
import { users } from './users';

/**
 * The user's daily nutrition targets — one row per user. Values are derived
 * from the profile and goal (Mifflin-St Jeor BMR → activity-scaled TDEE →
 * goal-adjusted calories → macro split), or set explicitly by the user.
 *
 * `inputs_fingerprint` is a hash of every input the derivation consumed (age,
 * gender, height, weight, activity level, goal, target weight). When the stored
 * fingerprint no longer matches the profile, `derived` targets are recomputed
 * automatically on the next read — so editing a profile can never leave stale
 * targets behind. `custom` targets ignore the fingerprint: an explicit user
 * choice is never silently overwritten.
 *
 * `bmr` and `tdee` are persisted alongside the targets so the client can show
 * the user how their numbers were reached without re-deriving them.
 */
export const nutritionTargets = pgTable(
  'nutrition_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    source: nutritionTargetSourceEnum('source').notNull().default('derived'),

    /** Daily energy target, kilocalories. */
    calories: integer('calories').notNull(),
    proteinG: integer('protein_g').notNull(),
    carbsG: integer('carbs_g').notNull(),
    fatG: integer('fat_g').notNull(),
    fiberG: integer('fiber_g').notNull(),
    /** Daily fluid target, millilitres. */
    waterMl: integer('water_ml').notNull(),
    /** How many eating occasions the plan assumes — drives "3 of 4 logged". */
    mealsPerDay: integer('meals_per_day').notNull().default(4),

    /** Basal metabolic rate, kcal/day (Mifflin-St Jeor). */
    bmr: numeric('bmr', { precision: 7, scale: 2 }).notNull(),
    /** Total daily energy expenditure, kcal/day (BMR × activity factor). */
    tdee: numeric('tdee', { precision: 7, scale: 2 }).notNull(),

    /** Hash of the profile/goal inputs these targets were derived from. */
    inputsFingerprint: text('inputs_fingerprint').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('nutrition_targets_user_id_key').on(table.userId)],
);

export const nutritionTargetsRelations = relations(nutritionTargets, ({ one }) => ({
  user: one(users, {
    fields: [nutritionTargets.userId],
    references: [users.id],
  }),
}));

export type NutritionTarget = typeof nutritionTargets.$inferSelect;
export type NewNutritionTarget = typeof nutritionTargets.$inferInsert;
