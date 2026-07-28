import { Redis } from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * A stand-in for the shared ioredis client.
 *
 * The Lua script runs inside Redis, so what is under test here is the adapter
 * around it: the arguments handed to the script, the unit conversion on the way
 * back, and — the part that matters most — what happens when Redis is not there.
 */
class FakeRedis {
  defineCommand = jest.fn();
  vitalThrottle = jest.fn();
}

const buildStorage = (): { storage: RedisThrottlerStorage; redis: FakeRedis } => {
  const redis = new FakeRedis();
  const storage = new RedisThrottlerStorage(redis as unknown as Redis);
  storage.onModuleInit();
  return { storage, redis };
};

describe('RedisThrottlerStorage', () => {
  it('registers the script once, as a named command', () => {
    const { redis } = buildStorage();

    expect(redis.defineCommand).toHaveBeenCalledTimes(1);
    expect(redis.defineCommand).toHaveBeenCalledWith(
      'vitalThrottle',
      expect.objectContaining({ numberOfKeys: 2, lua: expect.stringContaining('INCR') }),
    );
  });

  it('derives the hit and block keys from the guard’s key', async () => {
    const { storage, redis } = buildStorage();
    redis.vitalThrottle.mockResolvedValue([1, 60_000, 0, 0]);

    await storage.increment('vital:v1:rl:default:route:u:abc', 60_000, 120, 30_000, 'default');

    expect(redis.vitalThrottle).toHaveBeenCalledWith(
      'vital:v1:rl:default:route:u:abc:hits',
      'vital:v1:rl:default:route:u:abc:blocked',
      '60000',
      '120',
      '30000',
    );
  });

  /**
   * The library hands `increment` milliseconds but expects the record back in
   * seconds. Getting this wrong is silent and severe — a 60-second window would
   * be reported as 60,000 seconds in the `X-RateLimit-Reset` header.
   */
  it('converts the script’s milliseconds into whole seconds', async () => {
    const { storage, redis } = buildStorage();
    redis.vitalThrottle.mockResolvedValue([5, 42_000, 0, 0]);

    const record = await storage.increment('key', 60_000, 120, 30_000, 'default');

    expect(record).toEqual({
      totalHits: 5,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('rounds a partial second up, never down to zero', async () => {
    const { storage, redis } = buildStorage();
    redis.vitalThrottle.mockResolvedValue([1, 1, 0, 0]);

    const record = await storage.increment('key', 60_000, 120, 30_000, 'default');

    expect(record.timeToExpire).toBe(1);
  });

  it('reports a block with the remaining penalty', async () => {
    const { storage, redis } = buildStorage();
    redis.vitalThrottle.mockResolvedValue([121, 15_000, 1, 15_000]);

    const record = await storage.increment('key', 60_000, 120, 30_000, 'default');

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(15);
    expect(record.totalHits).toBe(121);
  });

  /**
   * The deliberate availability trade-off: rate limiting is a protection, not a
   * correctness requirement, and a Redis outage must not become a total API
   * outage. The request is allowed through and the record describes a coherent
   * empty window so the response headers stay sane.
   */
  it('fails open when Redis is unreachable', async () => {
    const { storage, redis } = buildStorage();
    redis.vitalThrottle.mockRejectedValue(new Error('ECONNREFUSED'));

    const record = await storage.increment('key', 60_000, 120, 30_000, 'default');

    expect(record).toEqual({
      totalHits: 0,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('does not throw when the script itself errors', async () => {
    const { storage, redis } = buildStorage();
    redis.vitalThrottle.mockRejectedValue(new Error('NOSCRIPT'));

    await expect(
      storage.increment('key', 1_000, 1, 1_000, 'global'),
    ).resolves.toMatchObject({ isBlocked: false });
  });
});
