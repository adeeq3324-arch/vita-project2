import type { RedisOptions } from 'ioredis';
import type { ConfigService } from '@nestjs/config';

/** Injection token for the shared ioredis client (caching + health checks). */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Builds ioredis connection options from validated configuration. Shared by the
 * standalone Redis client and the BullMQ root connection so both talk to the
 * exact same instance with identical TLS/auth settings.
 */
export const buildRedisOptions = (config: ConfigService): RedisOptions => {
  const tls = config.get<boolean>('redis.tls');
  return {
    host: config.get<string>('redis.host'),
    port: config.get<number>('redis.port'),
    password: config.get<string>('redis.password'),
    tls: tls ? {} : undefined,
    // Required by BullMQ; safe/sensible for the shared client too.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
};
