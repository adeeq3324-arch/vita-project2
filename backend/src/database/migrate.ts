import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const MIGRATIONS_FOLDER = './drizzle';

/**
 * Standalone migration runner. Applies every pending SQL migration in
 * `./drizzle` against the configured database, then exits. Intended to run in
 * CI/CD and as a container release step — never as part of the request path.
 */
async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Cannot run migrations.');
  }

  // No migrations have been generated yet (empty schema / Phase 0). The Drizzle
  // journal is created by `db:generate` once the first table is defined; until
  // then there is nothing to apply and this is a successful no-op.
  const journal = resolve(process.cwd(), MIGRATIONS_FOLDER, 'meta', '_journal.json');
  if (!existsSync(journal)) {
    // eslint-disable-next-line no-console
    console.log('No migrations found — nothing to apply.');
    return;
  }

  const ssl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1';

  // A dedicated single connection is used for migrations (max: 1).
  const client = postgres(url, { max: 1, ssl: ssl ? 'require' : undefined });
  const db = drizzle(client);

  try {
    // eslint-disable-next-line no-console
    console.log('Running database migrations…');
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    // eslint-disable-next-line no-console
    console.log('Migrations applied successfully.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

runMigrations().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', error);
  process.exit(1);
});
