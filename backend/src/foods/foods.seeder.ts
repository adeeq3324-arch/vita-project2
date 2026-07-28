import { sql } from 'drizzle-orm';
import type { Database } from '../database/database.constants';
import { foods, type NewFood } from '../database/schema';
import { CATEGORY_ACCENT, CATEGORY_ICON } from './data/food-presentation';
import { STARTER_FOODS, type StarterFood } from './data/starter-foods';

/** Rows per statement. Keeps the parameter count well inside Postgres' limit. */
const BATCH_SIZE = 100;

export interface SeedResult {
  /** Rows in the source dataset. */
  total: number;
  /** Rows written (inserted or updated) — the seeder always converges. */
  written: number;
}

/** Maps an authored entry to its database row, filling presentation defaults. */
function toRow(food: StarterFood): NewFood {
  return {
    slug: food.slug,
    name: food.name,
    brand: food.brand ?? null,
    category: food.category,
    servingLabel: food.servingLabel,
    servingSizeG: food.servingSizeG.toString(),
    calories: food.calories.toString(),
    proteinG: food.protein.toString(),
    carbsG: food.carbs.toString(),
    fatG: food.fat.toString(),
    fiberG: (food.fiber ?? 0).toString(),
    sugarG: (food.sugar ?? 0).toString(),
    saturatedFatG: (food.saturatedFat ?? 0).toString(),
    sodiumMg: (food.sodium ?? 0).toString(),
    icon: food.icon ?? CATEGORY_ICON[food.category],
    accent: CATEGORY_ACCENT[food.category],
  };
}

/**
 * Loads the starter catalogue into `foods`.
 *
 * Idempotent by design: rows are upserted on `slug`, so running it repeatedly
 * converges on the dataset without duplicating entries or changing the `id`
 * values that existing diary rows point at. That makes it safe to run on every
 * deploy — correcting a nutrition value is just an edit to `starter-foods.ts`
 * plus a re-run.
 *
 * Rows are *not* deleted when removed from the dataset: a food that users have
 * already logged must keep existing so their history stays intact.
 */
export async function seedFoods(db: Database): Promise<SeedResult> {
  const rows = STARTER_FOODS.map(toRow);

  const duplicate = findDuplicateSlug(rows);
  if (duplicate) {
    throw new Error(`Starter food dataset contains a duplicate slug: "${duplicate}".`);
  }

  let written = 0;

  await db.transaction(async (tx) => {
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);

      const inserted = await tx
        .insert(foods)
        .values(batch)
        .onConflictDoUpdate({
          target: foods.slug,
          set: {
            name: sql`excluded.name`,
            brand: sql`excluded.brand`,
            category: sql`excluded.category`,
            servingLabel: sql`excluded.serving_label`,
            servingSizeG: sql`excluded.serving_size_g`,
            calories: sql`excluded.calories`,
            proteinG: sql`excluded.protein_g`,
            carbsG: sql`excluded.carbs_g`,
            fatG: sql`excluded.fat_g`,
            fiberG: sql`excluded.fiber_g`,
            sugarG: sql`excluded.sugar_g`,
            saturatedFatG: sql`excluded.saturated_fat_g`,
            sodiumMg: sql`excluded.sodium_mg`,
            icon: sql`excluded.icon`,
            accent: sql`excluded.accent`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: foods.id });

      written += inserted.length;
    }
  });

  return { total: rows.length, written };
}

function findDuplicateSlug(rows: NewFood[]): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.slug)) {
      return row.slug;
    }
    seen.add(row.slug);
  }
  return null;
}
