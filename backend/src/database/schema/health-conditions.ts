import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { healthConditionEnum } from './enums';
import { users } from './users';

/**
 * Join table modelling the many-to-many relationship between users and the
 * fixed catalogue of health conditions (see `healthConditionEnum`). A user has
 * zero or more conditions; each condition appears at most once per user
 * (`user_id` + `condition` unique). Rows cascade-delete with the account.
 */
export const healthConditions = pgTable(
  'health_conditions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    condition: healthConditionEnum('condition').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('health_conditions_user_condition_key').on(table.userId, table.condition),
    index('health_conditions_user_id_idx').on(table.userId),
  ],
);

export const healthConditionsRelations = relations(healthConditions, ({ one }) => ({
  user: one(users, {
    fields: [healthConditions.userId],
    references: [users.id],
  }),
}));

export type HealthConditionRow = typeof healthConditions.$inferSelect;
export type NewHealthConditionRow = typeof healthConditions.$inferInsert;
