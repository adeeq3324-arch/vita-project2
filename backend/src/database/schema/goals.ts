import { relations } from 'drizzle-orm';
import { date, numeric, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryGoalEnum } from './enums';
import { users } from './users';

/**
 * The user's active goal. One row per user for Phase 1 (`user_id` unique);
 * re-submitting onboarding updates it in place. Target dates are optional —
 * the current onboarding flow does not collect them, but the columns exist so
 * scheduling features can populate them later without a migration.
 */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    primaryGoal: primaryGoalEnum('primary_goal').notNull(),
    /** Desired weight in kilograms; null when the user has no weight target. */
    targetWeightKg: numeric('target_weight_kg', { precision: 5, scale: 2 }),
    /** Date the user starts working toward the goal. */
    startDate: date('start_date'),
    /** Target completion date for the goal. */
    targetDate: date('target_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('goals_user_id_key').on(table.userId)],
);

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
}));

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
