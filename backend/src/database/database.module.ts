import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DRIZZLE, PG_CONNECTION, type PgClient } from './database.constants';
import * as schema from './schema';

/**
 * Global database module. Owns a single pooled postgres.js connection to the
 * Supabase Postgres instance and the Drizzle ORM client bound to it. Both are
 * exported for injection; the underlying pool is closed gracefully on shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PgClient => {
        const url = config.getOrThrow<string>('database.url');
        const ssl = config.get<boolean>('database.ssl');
        const max = config.get<number>('database.maxConnections');

        return postgres(url, {
          max,
          ssl: ssl ? 'require' : undefined,
          prepare: true,
          connect_timeout: 10,
          idle_timeout: 30,
        });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_CONNECTION],
      useFactory: (client: PgClient) => drizzle(client, { schema, casing: 'snake_case' }),
    },
  ],
  exports: [PG_CONNECTION, DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_CONNECTION) private readonly client: PgClient) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.end({ timeout: 5 });
      this.logger.log('Postgres connection pool closed.');
    } catch (error) {
      this.logger.error('Error while closing Postgres connection pool.', error as Error);
    }
  }
}
