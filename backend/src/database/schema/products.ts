import { jsonb, numeric, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** A healthier stand-in the AI suggests in place of a scanned product. */
export interface ProductAlternative {
  name: string;
  reason: string;
}

/**
 * Packaged products, keyed by barcode.
 *
 * This is a **shared cache, not user data**. A barcode identifies the same
 * product for everyone, so the first user to scan one pays for the lookup and
 * every subsequent scan of it — by anyone — is a single indexed read. That is
 * what keeps the scanner fast and its running cost bounded as the user base
 * grows.
 *
 * Only the product-intrinsic facts live here. The personalised health insight
 * depends on who is asking and is therefore written to `scan_results` instead,
 * never cached on the product.
 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** The scanned code itself — EAN/UPC — and the natural key for lookups. */
  barcode: text('barcode').notNull().unique(),

  brand: text('brand').notNull(),
  name: text('name').notNull(),

  /** Ingredient list, most-significant first. Empty when none could be determined. */
  ingredients: text('ingredients').array().notNull().default([]),

  /** Overall nutritional quality of the product itself, 0–100. */
  rating: smallint('rating').notNull(),

  /**
   * Declared nutrition per serving.
   *
   * Product-intrinsic like everything else here — the label says the same thing
   * whoever is holding the packet — so it is cached once rather than re-derived
   * on every scan. Without it a second user scanning a known barcode would have
   * no macros to record against their own scan.
   */
  calories: numeric('calories', { precision: 8, scale: 2 }).notNull().default('0'),
  proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull().default('0'),
  carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull().default('0'),
  fatG: numeric('fat_g', { precision: 7, scale: 2 }).notNull().default('0'),

  /** Healthier substitutes, each with a one-line justification. */
  aiAlternatives: jsonb('ai_alternatives').$type<ProductAlternative[]>().notNull().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
