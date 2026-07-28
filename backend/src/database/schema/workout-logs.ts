import { relations } from 'drizzle-orm';
import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accentColorEnum, workoutIntensityEnum, workoutTypeEnum } from './enums';
import { users } from './users';

/**
 * The training diary — one row per session the user completed.
 *
 * Mirrors the food diary's split between the exact instant (`performed_at`) and
 * the user's local calendar day (`performed_on`): every per-day roll-up groups on
 * the latter, so a late-night session counts toward the day the user thinks they
 * trained on rather than whichever UTC day the server saw.
 *
 * `calories_burned` is stored rather than derived on read. It is an estimate made
 * from the profile at log time (see `WorkoutLogsService`), and a user who later
 * changes weight must not have their training history quietly rewritten.
 *
 * The presentation columns (`icon`, `accent`) are snapshotted for the same reason
 * `meal_logs` snapshots them: history should render identically forever, even if
 * the defaults for a workout type change in a later release.
 */
export const workoutLogs = pgTable(
  'workout_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: workoutTypeEnum('type').notNull(),
    /** What the user called the session ("Upper body push"). */
    name: text('name').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    /** Energy burned, kcal. Estimated from type, intensity, duration and weight. */
    caloriesBurned: integer('calories_burned').notNull().default(0),
    intensity: workoutIntensityEnum('intensity').notNull().default('moderate'),

    /** Exact instant the session took place. */
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
    /** The user's local calendar day this session belongs to (YYYY-MM-DD). */
    performedOn: date('performed_on').notNull(),

    icon: text('icon').notNull().default('dumbbell'),
    accent: accentColorEnum('accent').notNull().default('violet'),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Per-day roll-ups and the workout-frequency chart.
    index('workout_logs_user_day_idx').on(table.userId, table.performedOn),
    // "Recent workouts" — newest first for the current user.
    index('workout_logs_user_performed_at_idx').on(table.userId, table.performedAt.desc()),
    index('workout_logs_user_type_idx').on(table.userId, table.type),
  ],
);

export const workoutLogsRelations = relations(workoutLogs, ({ one }) => ({
  user: one(users, {
    fields: [workoutLogs.userId],
    references: [users.id],
  }),
}));

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type NewWorkoutLog = typeof workoutLogs.$inferInsert;
export type WorkoutType = WorkoutLog['type'];
export type WorkoutIntensity = WorkoutLog['intensity'];
