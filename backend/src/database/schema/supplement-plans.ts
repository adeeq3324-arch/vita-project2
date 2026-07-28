import { relations } from 'drizzle-orm';
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { generationStatusEnum, supplementTimeEnum } from './enums';
import { users } from './users';

/**
 * An AI-generated supplement regimen, scoped to one calendar month.
 *
 * Supplementation is a slow-moving thing: reviewing it monthly matches how the
 * advice actually changes and keeps generation cost predictable. `month_start_date`
 * is always the first of the month, and the unique index over (user, month) is
 * what makes "generate" idempotent — a second request in the same month returns
 * the existing plan instead of producing a competing one.
 *
 * Shares the `idle → generating → ready | failed` lifecycle with meal plans, so
 * the client polls both with one code path.
 */
export const supplementPlans = pgTable(
  'supplement_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** First day of the month this plan covers (YYYY-MM-01, user-local). */
    monthStartDate: date('month_start_date').notNull(),
    status: generationStatusEnum('status').notNull().default('idle'),

    /** Populated when generation fails, so the client can explain why. */
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('supplement_plans_user_month_key').on(table.userId, table.monthStartDate),
    index('supplement_plans_user_created_idx').on(table.userId, table.createdAt.desc()),
  ],
);

/**
 * One supplement in a monthly regimen.
 *
 * `guidance` is a single free-text field on purpose. Dosage, timing rationale
 * and practical tips are not independent facts to be stored in separate columns
 * — they only make sense together, and splitting them would invite the UI to
 * render a dose figure stripped of the caveats that qualify it. The generator
 * always closes this text with a line directing the user to a healthcare
 * professional, so the disclaimer travels with the advice wherever it is shown.
 */
export const supplementPlanItems = pgTable(
  'supplement_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplementPlanId: uuid('supplement_plan_id')
      .notNull()
      .references(() => supplementPlans.id, { onDelete: 'cascade' }),

    supplementName: text('supplement_name').notNull(),
    bestTime: supplementTimeEnum('best_time').notNull(),

    /** Suggested range, timing rationale, tips and the disclaimer, as one piece. */
    guidance: text('guidance').notNull(),
    /** Why this supplement was suggested for this user, in one short line. */
    purpose: text('purpose').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('supplement_plan_items_plan_idx').on(table.supplementPlanId)],
);

export const supplementPlansRelations = relations(supplementPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [supplementPlans.userId],
    references: [users.id],
  }),
  items: many(supplementPlanItems),
}));

export const supplementPlanItemsRelations = relations(supplementPlanItems, ({ one }) => ({
  plan: one(supplementPlans, {
    fields: [supplementPlanItems.supplementPlanId],
    references: [supplementPlans.id],
  }),
}));

export type SupplementPlan = typeof supplementPlans.$inferSelect;
export type NewSupplementPlan = typeof supplementPlans.$inferInsert;
export type SupplementPlanItem = typeof supplementPlanItems.$inferSelect;
export type NewSupplementPlanItem = typeof supplementPlanItems.$inferInsert;
