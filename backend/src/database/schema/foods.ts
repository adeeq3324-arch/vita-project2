import { sql, type SQL } from 'drizzle-orm';
import {
  customType,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accentColorEnum, foodCategoryEnum } from './enums';

/**
 * Postgres `tsvector`. Drizzle has no first-class mapping for it, so it is
 * declared here purely so the generated column and its GIN index are part of
 * the schema; the value itself is never selected by the application.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
});

/**
 * The food catalogue — a shared, read-only nutrition database that backs the
 * "Add Meal" search bar. Rows are global (not user-owned) and are loaded by the
 * idempotent seeder in `src/foods/foods.seeder.ts`.
 *
 * Every macro is expressed **per serving**, with `serving_label` describing
 * that serving in human terms ("1 medium (118 g)") and `serving_size_g` giving
 * its mass in grams so the client can scale to arbitrary portions.
 *
 * `search_vector` is a generated `tsvector` over name + brand, indexed with
 * GIN. Search therefore runs entirely in Postgres (prefix-aware full text)
 * rather than scanning and filtering in the API process.
 */
export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Stable, human-readable key used by the seeder to upsert rows. It lets the
     * catalogue be re-seeded any number of times without duplicating entries or
     * churning the `id` values that diary entries reference.
     */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** Manufacturer/brand for packaged items; null for generic whole foods. */
    brand: text('brand'),
    category: foodCategoryEnum('category').notNull(),
    /** Human-readable serving description, e.g. "1 cup, cooked (158 g)". */
    servingLabel: text('serving_label').notNull(),
    /** Mass (or millilitres, for liquids) of one serving. */
    servingSizeG: numeric('serving_size_g', { precision: 8, scale: 2 }).notNull(),

    /** Energy per serving, in kilocalories. */
    calories: numeric('calories', { precision: 8, scale: 2 }).notNull(),
    proteinG: numeric('protein_g', { precision: 7, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 7, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 7, scale: 2 }).notNull(),
    fiberG: numeric('fiber_g', { precision: 7, scale: 2 }).notNull().default('0'),
    sugarG: numeric('sugar_g', { precision: 7, scale: 2 }).notNull().default('0'),
    saturatedFatG: numeric('saturated_fat_g', { precision: 7, scale: 2 }).notNull().default('0'),
    sodiumMg: numeric('sodium_mg', { precision: 8, scale: 2 }).notNull().default('0'),

    /** MaterialCommunityIcons glyph name the client renders on the food tile. */
    icon: text('icon').notNull().default('silverware-fork-knife'),
    /** Design-system accent paired with the icon. */
    accent: accentColorEnum('accent').notNull().default('neutral'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    /**
     * Full-text index source. `to_tsvector` with an explicit configuration is
     * IMMUTABLE, which is what lets this be a stored generated column.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', coalesce(${foods.name}, '') || ' ' || coalesce(${foods.brand}, ''))`,
    ),
  },
  (table) => [
    uniqueIndex('foods_slug_key').on(table.slug),
    index('foods_category_idx').on(table.category),
    index('foods_name_idx').on(table.name),
    index('foods_search_idx').using('gin', table.searchVector),
  ],
);

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
