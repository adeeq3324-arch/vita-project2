import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { coachPersonalityEnum, coachRoleEnum } from './enums';
import { users } from './users';

/**
 * A thread with the AI health coach.
 *
 * `personality` is fixed per conversation rather than per user: a coaching voice
 * that changed halfway through a thread would make the history read as though it
 * were written by two different people, and it is also what the system prompt is
 * built from on every turn.
 *
 * `updated_at` is bumped on each new message so the conversation list can be
 * ordered by genuine recency rather than by when the thread was opened.
 */
export const coachConversations = pgTable(
  'coach_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    personality: coachPersonalityEnum('personality').notNull().default('motivator'),
    /** Derived from the opening message when the client does not supply one. */
    title: text('title').notNull().default('New conversation'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('coach_conversations_user_updated_idx').on(table.userId, table.updatedAt.desc())],
);

/**
 * One turn in a coach thread.
 *
 * The assistant's turn is written only once its stream has finished, so a
 * connection dropped mid-answer leaves no truncated reply behind — the user's
 * question survives and can simply be asked again.
 */
export const coachMessages = pgTable(
  'coach_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => coachConversations.id, { onDelete: 'cascade' }),

    role: coachRoleEnum('role').notNull(),
    content: text('content').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('coach_messages_conversation_created_idx').on(table.conversationId, table.createdAt)],
);

export const coachConversationsRelations = relations(coachConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [coachConversations.userId],
    references: [users.id],
  }),
  messages: many(coachMessages),
}));

export const coachMessagesRelations = relations(coachMessages, ({ one }) => ({
  conversation: one(coachConversations, {
    fields: [coachMessages.conversationId],
    references: [coachConversations.id],
  }),
}));

export type CoachConversation = typeof coachConversations.$inferSelect;
export type NewCoachConversation = typeof coachConversations.$inferInsert;
export type CoachMessage = typeof coachMessages.$inferSelect;
export type NewCoachMessage = typeof coachMessages.$inferInsert;
