import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * One row per user per calendar day, holding the non-dietary side of the
 * dashboard: movement, hydration, body weight, workout completion and the
 * day's composite health score.
 *
 * Calories **consumed** deliberately do not live here — `meal_logs` is their
 * single source of truth and the day's intake is always aggregated from it, so
 * the two can never drift apart. `active_calories` is the complementary figure:
 * energy *burned* through activity.
 *
 * `health_score` is a derived 0–100 value (see `DailyMetricsService`) but is
 * persisted rather than recomputed on read, so historical trends stay stable
 * even as the scoring inputs (targets) change over time.
 */
export const dailyMetrics = pgTable(
  'daily_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The user's local calendar day (YYYY-MM-DD). */
    date: date('date').notNull(),

    steps: integer('steps').notNull().default(0),
    /** Fluid intake for the day, millilitres. */
    waterMl: integer('water_ml').notNull().default(0),
    /** Energy burned through activity, kilocalories. */
    activeCalories: integer('active_calories').notNull().default(0),
    /** Morning body weight in kilograms; null on days the user did not weigh in. */
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),

    workoutCompleted: boolean('workout_completed').notNull().default(false),
    workoutMinutes: integer('workout_minutes').notNull().default(0),

    /** Composite adherence score for the day, 0–100. Null until first computed. */
    healthScore: smallint('health_score'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('daily_metrics_user_date_key').on(table.userId, table.date)],
);

export const dailyMetricsRelations = relations(dailyMetrics, ({ one }) => ({
  user: one(users, {
    fields: [dailyMetrics.userId],
    references: [users.id],
  }),
}));

export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type NewDailyMetric = typeof dailyMetrics.$inferInsert;
