import { relations } from 'drizzle-orm';
import { integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { activityLevelEnum, genderEnum, unitSystemEnum } from './enums';
import { users } from './users';

/**
 * Per-user profile — the personal and anthropometric data collected during
 * onboarding. One row per user (`user_id` unique), cascade-deleted with the
 * account.
 *
 * Height and weight are always persisted in canonical metric units (cm / kg);
 * `unit_system` records only the user's display preference so the client can
 * convert for presentation without any lossy storage.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Display name — maps to the "username" field captured on the client. */
    name: text('name').notNull(),
    age: integer('age').notNull(),
    gender: genderEnum('gender').notNull(),
    /** Height in centimetres. */
    heightCm: numeric('height_cm', { precision: 5, scale: 2 }).notNull(),
    /** Weight in kilograms. */
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }).notNull(),
    activityLevel: activityLevelEnum('activity_level').notNull(),
    unitSystem: unitSystemEnum('unit_system').notNull().default('metric'),
    /**
     * IANA time zone (e.g. `Europe/London`). Every day-scoped feature — the
     * food diary, daily metrics, the home feed — resolves "today" and the
     * midnight boundary in this zone, so a diary day always matches the user's
     * own clock rather than the server's. Defaults to UTC.
     */
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('profiles_user_id_key').on(table.userId)],
);

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
