import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { aiJobStatusEnum, aiJobTypeEnum } from './enums';
import { users } from './users';

/**
 * A durable record of every unit of AI work the platform has been asked to do.
 *
 * The queue already tracks jobs, but only in Redis and only while they matter to
 * it: completed jobs are trimmed, a flushed instance forgets everything, and
 * none of it is queryable per user. This table is the answer to "what did we ask
 * the model to do, for whom, and how did it end" — which is what support,
 * cost attribution and any retry decision actually need.
 *
 * `result_ref_id` points at the row the job produced (a meal plan, a supplement
 * plan, a scan result). It is intentionally *not* a foreign key: one column has
 * to reference several different tables, and the alternative — a nullable FK per
 * artefact type — would add a column to this table every time a new kind of job
 * is introduced.
 */
export const aiJobs = pgTable(
  'ai_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: aiJobTypeEnum('type').notNull(),
    status: aiJobStatusEnum('status').notNull().default('queued'),

    /** Id of the row this job produced, once it has produced one. */
    resultRefId: uuid('result_ref_id'),
    /** Why the job failed, in terms a client can surface to the user. */
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_jobs_user_created_idx').on(table.userId, table.createdAt.desc()),
    // Looking a job up from the artefact it produced, for status polling.
    index('ai_jobs_result_ref_idx').on(table.resultRefId),
    index('ai_jobs_status_idx').on(table.status),
  ],
);

export const aiJobsRelations = relations(aiJobs, ({ one }) => ({
  user: one(users, {
    fields: [aiJobs.userId],
    references: [users.id],
  }),
}));

export type AiJob = typeof aiJobs.$inferSelect;
export type NewAiJob = typeof aiJobs.$inferInsert;
export type AiJobStatus = AiJob['status'];
export type AiJobType = AiJob['type'];
