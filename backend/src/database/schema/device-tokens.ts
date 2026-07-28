import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { devicePlatformEnum } from './enums';
import { users } from './users';

/**
 * A device a user can receive push notifications on.
 *
 * `token` is unique across the whole table rather than per user, because that is
 * how the push services behave: a handset that is handed over or signed into a
 * second account reissues the *same* token, and the row must move to the new owner
 * instead of leaving two accounts believing they own that device — which would
 * deliver one user's reminders to another. Registration therefore upserts on the
 * token and rewrites `user_id`.
 *
 * `revoked_at` is a soft delete. A token the push service reports as unregistered
 * is retired rather than removed, so a device that comes back (a reinstall
 * reissuing the same token) is reactivated by the ordinary registration path, and
 * the row keeps a record of why it went quiet.
 */
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Opaque push token issued to the app by the platform's push service. */
    token: text('token').notNull(),
    platform: devicePlatformEnum('platform').notNull(),
    /** Human-readable device label, for a "your devices" list. */
    deviceName: text('device_name'),

    /** Last time the app confirmed this token is still current. */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when the push service rejected the token, or the user signed out. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('device_tokens_token_key').on(table.token),
    index('device_tokens_user_idx').on(table.userId),
  ],
);

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
export type DevicePlatform = DeviceToken['platform'];
