import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';

/**
 * What one `increment` reports back to the guard.
 *
 * Declared here rather than imported: @nestjs/throttler defines this shape but
 * does not re-export it from its package entry point, and reaching into the
 * package's `dist/` would couple this file to the library's internal layout.
 * Structural typing means the locally declared shape satisfies
 * {@link ThrottlerStorage} exactly.
 *
 * Both durations are **seconds**, while the arguments to `increment` are
 * milliseconds — an asymmetry inherited from the library's own contract.
 */
interface ThrottlerStorageRecord {
  /** Hits recorded in the current window, including this one. */
  totalHits: number;
  /** Seconds until the window resets. */
  timeToExpire: number;
  /** Whether this request is being refused. */
  isBlocked: boolean;
  /** Seconds until the block lifts. */
  timeToBlockExpire: number;
}

/**
 * Atomic hit-count-and-block, evaluated inside Redis.
 *
 * A script rather than a pipeline because the read-modify-write must be
 * indivisible: two instances incrementing the same counter concurrently would
 * otherwise both observe a below-limit value and both let the request through,
 * which is precisely the burst a rate limiter exists to stop.
 *
 * Everything is expressed in milliseconds; the caller converts to seconds.
 *
 *   KEYS[1] hit counter   KEYS[2] block marker
 *   ARGV[1] window (ms)   ARGV[2] limit   ARGV[3] block duration (ms)
 *
 * Returns `{ totalHits, timeToExpire, isBlocked, timeToBlockExpire }`.
 */
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

-- Already blocked: report the remaining penalty without extending it, so a
-- client that keeps hammering cannot push its own unblock time further away.
local blockPttl = redis.call('PTTL', blockKey)
if blockPttl > 0 then
  local blockedHits = tonumber(redis.call('GET', hitsKey) or '0')
  return { blockedHits, blockPttl, 1, blockPttl }
end

local hits = redis.call('INCR', hitsKey)
local pttl = redis.call('PTTL', hitsKey)

-- A fresh counter (INCR creates it without a TTL) starts the window now.
if pttl < 0 then
  redis.call('PEXPIRE', hitsKey, windowMs)
  pttl = windowMs
end

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  return { hits, pttl, 1, blockMs }
end

return { hits, pttl, 0, 0 }
`;

/** The shared client, once the custom command has been attached to it. */
interface ThrottlingRedis extends Redis {
  vitalThrottle(
    hitsKey: string,
    blockKey: string,
    windowMs: string,
    limit: string,
    blockMs: string,
  ): Promise<[number, number, number, number]>;
}

/** Milliseconds → whole seconds, the unit `ThrottlerStorageRecord` reports in. */
const toSeconds = (milliseconds: number): number => Math.ceil(milliseconds / 1000);

/**
 * Redis-backed {@link ThrottlerStorage}.
 *
 * The in-memory storage @nestjs/throttler ships with counts per process, which
 * silently multiplies every limit by the number of running instances. Counting
 * in Redis means the limit is the limit no matter how many containers are up,
 * and it survives a rolling deploy.
 *
 * Failures **fail open**: if Redis is unreachable the request is allowed
 * through and the outage is logged. That matches how the rest of the system
 * treats Redis — an optimisation, never a correctness dependency — and refuses
 * to turn a cache outage into a total API outage. The per-IP shield in front of
 * the application remains the backstop for that window.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleInit(): void {
    // ioredis caches the script and uses EVALSHA, so the body travels once per
    // connection rather than on every request.
    this.redis.defineCommand('vitalThrottle', {
      numberOfKeys: 2,
      lua: INCREMENT_SCRIPT,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = await (
        this.redis as ThrottlingRedis
      ).vitalThrottle(
        `${key}:hits`,
        `${key}:blocked`,
        String(ttl),
        String(limit),
        String(blockDuration),
      );

      return {
        totalHits,
        timeToExpire: toSeconds(timeToExpire),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: toSeconds(timeToBlockExpire),
      };
    } catch (error) {
      this.logger.warn(
        `Rate-limit check failed open for "${key}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      // Reported as a first hit in an empty window: never blocked, and the
      // rate-limit headers still describe a coherent state to the client.
      return {
        totalHits: 0,
        timeToExpire: toSeconds(ttl),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
