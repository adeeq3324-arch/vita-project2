import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { generationStatusEnum, supplementTierEnum, supplementTimeEnum } from './enums';
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

/** One line of a supplement facts panel: what is in a serving, and how much. */
export interface SupplementIngredient {
  /** The substance, e.g. "Vitamin D3 (cholecalciferol)". */
  name: string;
  /** The amount in one serving, with its unit, e.g. "1000 IU", "25 g". */
  amount: string;
}

/**
 * One supplement in a monthly regimen.
 *
 * The item deliberately describes the *substance* rather than instructing the
 * user on taking it. `ingredients` and `servingSize` are what a label states and
 * a person can check; `recommendation` is the one piece of advice attached to it,
 * and it always resolves to the same thing — take this to a healthcare provider
 * and agree a dose with them. Storing it that way means no surface can render
 * the substance without the direction to ask a professional about it.
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
    /** Whether the regimen depends on this item or merely offers it. */
    tier: supplementTierEnum('tier').notNull().default('core'),

    /** What kind of supplement this is, e.g. "Protein supplement". */
    category: text('category').notNull().default(''),
    /** The one-line benefit shown under the name, e.g. "Muscle recovery & growth". */
    headline: text('headline').notNull().default(''),

    /** What one serving is, as a label states it: "1 capsule", "1 scoop (30 g)". */
    servingSize: text('serving_size').notNull().default(''),
    /**
     * The supplement facts panel: every substance in a serving and how much of
     * it, including the energy and macronutrients where the form has any.
     *
     * Stored as JSON rather than two parallel arrays because a name and its
     * amount are one fact — parallel arrays can fall out of step, and a panel
     * showing "25 g" against the wrong substance is worse than showing nothing.
     */
    ingredients: jsonb('ingredients')
      .$type<SupplementIngredient[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** Why this supplement was suggested for this user, in one short line. */
    purpose: text('purpose').notNull(),
    /**
     * The closing advice: see a healthcare provider before starting, and agree
     * the amount with them. Written per item so it can name what actually
     * matters for that substance, and guaranteed by code to carry the standing
     * disclaimer regardless of what the model returned.
     */
    recommendation: text('recommendation').notNull().default(''),

    /**
     * The short, checkable claims behind the suggestion. Stored as a list rather
     * than a paragraph because the client renders them as a checklist, and a
     * paragraph split on punctuation is a rendering bug waiting to happen.
     */
    benefits: text('benefits').array().notNull().default([]),
    /**
     * Cautions specific to this supplement — interactions, storage, who should
     * not take it. Kept separate from the facts panel so a surface can never
     * show what is in the product while omitting who should not take it.
     */
    safety: text('safety').array().notNull().default([]),

    /**
     * Product identity, for the day a real supplement catalogue backs this.
     * Never model-generated: an invented brand or an invented rating is a
     * fabricated endorsement, so these stay null until something authoritative
     * fills them in, and the client simply omits what is missing.
     */
    brand: text('brand'),
    rating: numeric('rating', { precision: 2, scale: 1 }),
    ratingCount: integer('rating_count'),
    imageUrl: text('image_url'),

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
