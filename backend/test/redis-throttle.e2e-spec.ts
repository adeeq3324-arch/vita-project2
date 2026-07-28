import { Redis } from 'ioredis';
import { RedisThrottlerStorage } from '../src/common/throttler/redis-throttler.storage';

/**
 * The rate-limit script, executed by a real Redis.
 *
 * Everywhere else in this suite the script is stood in for by a TypeScript port
 * (`test/support/fake-redis.ts`), which is what lets the guards be exercised
 * over HTTP without a server. A port can drift from its original, and the Lua
 * is where the counting actually happens — so it is run here for real.
 *
 * Skipped when no Redis is reachable, so a developer without one still gets a
 * green suite. CI provides a Redis service, where these therefore always run;
 * the assertion in `beforeAll` makes a *misconfigured* CI fail loudly rather
 * than silently skipping the only test that covers the script.
 */
const REDIS_HOST = process.env.REDIS_HOST;
const REQUIRE_REDIS = process.env.CI === 'true';

const describeWithRedis = REDIS_HOST || REQUIRE_REDIS ? describe : describe.skip;

describeWithRedis('Rate-limit script against a real Redis', () => {
  let redis: Redis;
  let storage: RedisThrottlerStorage;

  /** A key unique to this run, so a re-run never inherits a previous count. */
  const keyFor = (name: string): string => `test:throttle:${process.pid}:${Date.now()}:${name}`;

  beforeAll(async () => {
    redis = new Redis({
      host: REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      // Fail fast rather than retrying for a minute when nothing is listening.
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });

    await redis.connect();

    storage = new RedisThrottlerStorage(redis);
    storage.onModuleInit();
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
  });

  it('counts hits within the window', async () => {
    const key = keyFor('counts');

    const first = await storage.increment(key, 60_000, 3, 60_000, 'default');
    const second = await storage.increment(key, 60_000, 3, 60_000, 'default');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(second.isBlocked).toBe(false);
  });

  it('blocks once the limit is exceeded', async () => {
    const key = keyFor('blocks');

    for (let i = 0; i < 3; i += 1) {
      const record = await storage.increment(key, 60_000, 3, 60_000, 'default');
      expect(record.isBlocked).toBe(false);
    }

    const refused = await storage.increment(key, 60_000, 3, 60_000, 'default');
    expect(refused.isBlocked).toBe(true);
    expect(refused.totalHits).toBe(4);
  });

  /**
   * The block must not extend itself. A client that keeps hammering while
   * blocked would otherwise push its own unblock time further away on every
   * request and never recover.
   */
  it('does not extend an existing block', async () => {
    const key = keyFor('no-extend');

    for (let i = 0; i < 4; i += 1) {
      await storage.increment(key, 60_000, 3, 10_000, 'default');
    }

    const first = await storage.increment(key, 60_000, 3, 10_000, 'default');
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const later = await storage.increment(key, 60_000, 3, 10_000, 'default');

    expect(first.isBlocked).toBe(true);
    expect(later.isBlocked).toBe(true);
    expect(later.timeToBlockExpire).toBeLessThan(first.timeToBlockExpire);
  });

  it('sets a TTL on a fresh window and reports it in seconds', async () => {
    const key = keyFor('ttl');

    const record = await storage.increment(key, 30_000, 10, 30_000, 'default');

    expect(record.timeToExpire).toBeGreaterThan(0);
    expect(record.timeToExpire).toBeLessThanOrEqual(30);
    expect(await redis.pttl(`${key}:hits`)).toBeGreaterThan(0);
  });

  it('lets the window lapse, restarting the count', async () => {
    const key = keyFor('lapse');

    await storage.increment(key, 1_000, 10, 1_000, 'default');
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const afterLapse = await storage.increment(key, 1_000, 10, 1_000, 'default');

    expect(afterLapse.totalHits).toBe(1);
  });

  /**
   * The reason the logic is a script rather than a pipeline: concurrent callers
   * must not both observe a below-limit count and both be let through. Twenty
   * simultaneous requests against a limit of five must yield exactly five
   * allowed.
   */
  it('counts atomically under concurrent increments', async () => {
    const key = keyFor('atomic');

    const results = await Promise.all(
      Array.from({ length: 20 }, () => storage.increment(key, 60_000, 5, 60_000, 'default')),
    );

    const allowed = results.filter((record) => !record.isBlocked);
    expect(allowed).toHaveLength(5);

    // The five that got through were counted 1–5, each number issued exactly
    // once. Redis executes the script atomically, so no two callers can observe
    // the same count and both be admitted.
    const admitted = allowed.map((record) => record.totalHits).sort((a, b) => a - b);
    expect(admitted).toEqual([1, 2, 3, 4, 5]);

    // The sixth call trips the limit and sets the block; every call after that
    // takes the already-blocked branch, which reports the standing count without
    // incrementing it. That is what stops a client hammering its own block into
    // an ever-longer one.
    const refused = results.filter((record) => record.isBlocked);
    expect(refused).toHaveLength(15);
    expect(new Set(refused.map((record) => record.totalHits))).toEqual(new Set([6]));
  });

  it('keeps separate keys independent', async () => {
    const one = keyFor('independent-a');
    const two = keyFor('independent-b');

    await storage.increment(one, 60_000, 1, 60_000, 'default');
    await storage.increment(one, 60_000, 1, 60_000, 'default');

    const other = await storage.increment(two, 60_000, 1, 60_000, 'default');
    expect(other.isBlocked).toBe(false);
  });
});
