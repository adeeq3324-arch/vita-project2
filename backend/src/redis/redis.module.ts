import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT, buildRedisOptions } from './redis.constants';

/**
 * Global Redis module. Provides a single shared ioredis client used for caching
 * and liveness checks (BullMQ manages its own connections via `QueueModule`).
 * The client is disconnected gracefully on application shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const client = new Redis(buildRedisOptions(config));
        const logger = new Logger('RedisClient');
        client.on('error', (error) => logger.error('Redis client error', error));
        client.on('connect', () => logger.log('Connected to Redis.'));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed.');
    } catch (error) {
      this.logger.error('Error while closing Redis connection.', error as Error);
    }
  }
}
