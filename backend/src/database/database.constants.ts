import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import type * as schema from './schema';

/** Injection token for the raw postgres.js SQL client. */
export const PG_CONNECTION = Symbol('PG_CONNECTION');

/** Injection token for the Drizzle ORM database instance. */
export const DRIZZLE = Symbol('DRIZZLE');

/** Strongly-typed Drizzle database bound to the application schema. */
export type Database = PostgresJsDatabase<typeof schema>;

/** Raw postgres.js client type re-export for lifecycle/health consumers. */
export type PgClient = Sql;
