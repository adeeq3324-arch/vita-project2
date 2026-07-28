import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { seedFoods } from '../foods/foods.seeder';
import * as schema from './schema';

/**
 * Standalone reference-data seeder. Loads the starter food catalogue, then
 * exits. Intended to run after migrations as a CI/CD or container release step
 * — never as part of the request path.
 *
 * Safe to run repeatedly: every seeder it calls is idempotent.
 */
async function runSeed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Cannot seed the database.');
  }

  const ssl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1';

  // A dedicated single connection, matching the migration runner.
  const client = postgres(url, { max: 1, ssl: ssl ? 'require' : undefined });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  try {
    console.log('Seeding food catalogue…');
    const result = await seedFoods(db);
    console.log(`Food catalogue seeded: ${result.written}/${result.total} rows written.`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

runSeed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
