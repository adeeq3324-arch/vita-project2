import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { MetricsService } from '../observability/metrics.service';

/** Batch size for `SCAN`, keeping prefix deletes off the Redis event loop. */
const SCAN_COUNT = 250;

/**
 * JSON cache over the shared Redis client.
 *
 * Every operation is **best-effort**: Redis is an optimisation, never a
 * dependency of correctness. If it is unreachable or returns something
 * unparseable, the call degrades to a miss and the caller falls through to the
 * database. A cache outage therefore slows the API down; it never breaks it.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Reads and parses a cached value, or null on miss/failure.
   *
   * Hits, misses and failures are counted separately on purpose. A miss and an
   * outage look identical to the caller — both fall through to the database —
   * but they mean opposite things operationally: one is a cold cache doing its
   * job, the other is Redis being down while the API quietly runs uncached.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        this.metrics.recordCacheMiss();
        return null;
      }
      this.metrics.recordCacheHit();
      return JSON.parse(raw) as T;
    } catch (error) {
      this.metrics.recordCacheError();
      this.logger.warn(`Cache read failed for "${key}": ${this.describe(error)}`);
      return null;
    }
  }

  /** Stores a value with a TTL (seconds). Never throws. */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache write failed for "${key}": ${this.describe(error)}`);
    }
  }

  /**
   * Returns the cached value, or computes it with `factory`, caches it and
   * returns that. `factory` failures propagate untouched — only cache errors
   * are swallowed.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) {
      return hit;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Drops one or more keys. Never throws. */
  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn(`Cache delete failed for "${keys.join(', ')}": ${this.describe(error)}`);
    }
  }

  /**
   * Drops every key under `prefix`, streaming with `SCAN` rather than `KEYS` so
   * a large keyspace is never blocked while the deletion runs.
   */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          SCAN_COUNT,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Cache prefix delete failed for "${prefix}": ${this.describe(error)}`);
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
