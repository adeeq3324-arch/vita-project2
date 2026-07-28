import { relations } from 'drizzle-orm';
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { achievementCategoryEnum, achievementSurfaceEnum } from './enums';
import { users } from './users';

/**
 * A user's standing against one achievement — a badge, a streak or a milestone.
 *
 * The **catalogue** of achievements is code, not data (`achievements/achievement.catalog.ts`):
 * a definition is inseparable from the rule that unlocks it, so keeping the two
 * together means adding an achievement is one change in one file rather than a
 * migration that can disagree with the evaluator. This table holds only what code
 * cannot: how far *this* user has got, and the instant they crossed the line.
 *
 * `key` is therefore a catalogue key rather than a foreign key, and a row exists
 * only once a user has been evaluated against it. `progress`/`target` are
 * denormalised copies of the evaluation so the client can render a bar without
 * re-running it, and `unlocked_at` is written exactly once — re-evaluating a
 * user never moves the date they earned something, even if the metric later dips
 * back below the target.
 *
 * `notified_at` records the unlock push, so a user is congratulated once and not
 * again on every subsequent evaluation.
 */
export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Catalogue key, e.g. `streak_7`. Stable across releases. */
    key: text('key').notNull(),
    category: achievementCategoryEnum('category').notNull(),
    surface: achievementSurfaceEnum('surface').notNull().default('badge'),

    /** Where the user is against `target`, in the achievement's own unit. */
    progress: numeric('progress', { precision: 12, scale: 2 }).notNull().default('0'),
    /** The value that unlocks it, resolved per user (a weight goal is personal). */
    target: numeric('target', { precision: 12, scale: 2 }).notNull(),

    /** Instant the achievement was earned; null while it is still locked. */
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
    /** Instant the unlock push was delivered; null when never notified. */
    notifiedAt: timestamp('notified_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('achievements_user_key_key').on(table.userId, table.key),
    index('achievements_user_unlocked_idx').on(table.userId, table.unlockedAt.desc()),
  ],
);

export const achievementsRelations = relations(achievements, ({ one }) => ({
  user: one(users, {
    fields: [achievements.userId],
    references: [users.id],
  }),
}));

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type AchievementCategory = Achievement['category'];
export type AchievementSurface = Achievement['surface'];
