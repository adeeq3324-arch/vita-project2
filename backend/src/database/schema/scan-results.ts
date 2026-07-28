import { relations } from 'drizzle-orm';
import { index, numeric, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { scanTypeEnum } from './enums';
import { products } from './products';
import { users } from './users';

/**
 * The outcome of one scan, whichever scanner produced it.
 *
 * All three scanners share this table because they answer the same question in
 * different ways — "what is this and is it good for me" — and the user sees them
 * as one scan history. `type` says which produced the row and, with it, which of
 * the optional columns are populated:
 *
 *  - `food`         — photo analysis: `image_url`, macros, `health_score`
 *  - `colorQuality` — photo analysis of freshness: as above plus `freshness_score`
 *  - `barcode`      — packaged product: `barcode_value` and `product_id`
 *
 * Nutrition is stored as a **snapshot of the estimate at scan time**, exactly as
 * the food diary does: re-running the model later may say something different,
 * and history must not silently change underneath the user.
 */
export const scanResults = pgTable(
  'scan_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: scanTypeEnum('type').notNull(),

    /**
     * Storage **object path** of the analysed photo — not a URL. Null for
     * barcode scans.
     *
     * The scans bucket is private, so the only usable address for the image is a
     * signed URL, and a signed URL is stale the moment it is written. Persisting
     * the path and signing on read is what keeps old scans viewable indefinitely
     * without ever making the bucket public.
     */
    imageUrl: text('image_url'),
    /** The scanned code. Null for photo scans. */
    barcodeValue: text('barcode_value'),
    /** Set for barcode scans; the shared product record this scan resolved to. */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),

    foodName: text('food_name').notNull(),

    calories: numeric('calories', { precision: 8, scale: 2 }).notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 7, scale: 2 }).notNull(),

    /** How well this fits the user's goals and conditions, 0–100. */
    healthScore: smallint('health_score').notNull(),
    /** The model's explanation, written for the user rather than for a log. */
    aiInsight: text('ai_insight').notNull(),

    /** Visual freshness, 0–100. Only produced by the colour-quality scanner. */
    freshnessScore: smallint('freshness_score'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Scan history — newest first for the current user, optionally per scanner.
    index('scan_results_user_created_idx').on(table.userId, table.createdAt.desc()),
    index('scan_results_user_type_idx').on(table.userId, table.type),
  ],
);

export const scanResultsRelations = relations(scanResults, ({ one }) => ({
  user: one(users, {
    fields: [scanResults.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [scanResults.productId],
    references: [products.id],
  }),
}));

export type ScanResult = typeof scanResults.$inferSelect;
export type NewScanResult = typeof scanResults.$inferInsert;
