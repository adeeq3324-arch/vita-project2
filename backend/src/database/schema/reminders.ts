import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { accentColorEnum, reminderCategoryEnum } from './enums';
import { users } from './users';

/**
 * A recurring nudge: a name, a wall-clock time, and an on/off switch.
 *
 * Two representations of "when" are kept deliberately:
 *
 *   - `time_of_day` + `days_of_week` is the user's *intent* ("08:00, weekdays").
 *     It is stored as a bare local time, never an instant, so a reminder set for
 *     8am keeps firing at 8am across a daylight-saving change instead of drifting
 *     to 7am or 9am.
 *   - `next_run_at` is the resolved UTC instant of the next firing. Keeping it on
 *     the row is what lets the delivery sweep be a single indexed query
 *     (`enabled AND next_run_at <= now()`) rather than a scan that re-derives
 *     every user's clock, and it is recomputed whenever the intent changes.
 *
 * An empty `days_of_week` means *every day*, which is both the common case and
 * the safest default: a reminder can never be created that has no day on which
 * it would ever fire.
 *
 * `last_sent_at` is advanced in the same claim that advances `next_run_at`, so
 * two API instances sweeping at the same moment cannot both send the same nudge.
 */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    category: reminderCategoryEnum('category').notNull().default('custom'),
    /** Optional body for the push; the name alone is used when absent. */
    message: text('message'),

    /** Local wall-clock time the reminder fires at, `HH:MM:SS`. */
    timeOfDay: time('time_of_day').notNull(),
    /** ISO weekdays it repeats on (1 = Monday … 7 = Sunday). Empty means daily. */
    daysOfWeek: smallint('days_of_week').array().notNull().default([]),

    enabled: boolean('enabled').notNull().default(true),

    icon: text('icon').notNull().default('bell-ring'),
    accent: accentColorEnum('accent').notNull().default('violet'),

    /** Resolved UTC instant of the next firing. Always set, even when disabled. */
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    /** Instant the reminder last fired; null until it first does. */
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The delivery sweep's only query: due, enabled reminders in firing order.
    index('reminders_due_idx').on(table.enabled, table.nextRunAt),
    // The user's own list, ordered the way the screen renders it.
    index('reminders_user_time_idx').on(table.userId, table.timeOfDay),
  ],
);

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, {
    fields: [reminders.userId],
    references: [users.id],
  }),
}));

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type ReminderCategory = Reminder['category'];
