import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { authProviderEnum } from './enums';
import { profiles } from './profiles';
import { goals } from './goals';
import { healthConditions } from './health-conditions';
import { mealLogs } from './meal-logs';
import { nutritionTargets } from './nutrition-targets';
import { dailyMetrics } from './daily-metrics';
import { workoutLogs } from './workout-logs';
import { progressSnapshots } from './progress-snapshots';
import { achievements } from './achievements';
import { reminders } from './reminders';
import { deviceTokens } from './device-tokens';

/**
 * Application users. Each row mirrors a Supabase Auth user: `id` is the
 * `auth.users.id` UUID (we set it explicitly at sign-up rather than generating
 * a new one), so `auth.uid()` in RLS policies resolves directly to this key.
 *
 * Phase 1 supports email/password only. `provider` and `provider_account_id`
 * exist now so Google/Apple accounts can be added later purely as new enum
 * values and non-breaking data — no column changes, no destructive migration.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    provider: authProviderEnum('provider').notNull().default('email'),
    /** Subject id from the external identity provider; null for email accounts. */
    providerAccountId: text('provider_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_key').on(table.email),
    index('users_provider_idx').on(table.provider),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  goal: one(goals, {
    fields: [users.id],
    references: [goals.userId],
  }),
  healthConditions: many(healthConditions),
  nutritionTarget: one(nutritionTargets, {
    fields: [users.id],
    references: [nutritionTargets.userId],
  }),
  mealLogs: many(mealLogs),
  dailyMetrics: many(dailyMetrics),
  workoutLogs: many(workoutLogs),
  progressSnapshots: many(progressSnapshots),
  achievements: many(achievements),
  reminders: many(reminders),
  deviceTokens: many(deviceTokens),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
