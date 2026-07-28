import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration — used by `db:generate` (emit SQL migrations from
 * the TypeScript schema) and `db:studio`. Migrations are applied at runtime by
 * `src/database/migrate.ts`.
 */
export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
    ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1' ? 'require' : false,
  },
  verbose: true,
  strict: true,
});
