import { CacheKeys, CacheTtl } from './cache.keys';

/**
 * Cache keys are load-bearing for correctness, not just for speed: a key that
 * collides between two users serves one person's health data to another, and a
 * prefix that does not actually cover its keys leaves stale data behind after a
 * write. Both are asserted here directly.
 */
describe('CacheKeys', () => {
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';

  it('versions every key, so a payload shape change can retire the cache at once', () => {
    const keys = [
      CacheKeys.nutritionTargets(userA),
      CacheKeys.food('food-1'),
      CacheKeys.product('5000112637939'),
      CacheKeys.progressOverview(userA, 'week'),
      CacheKeys.achievements(userA),
    ];

    expect(keys.every((key) => key.startsWith('vital:v1:'))).toBe(true);
  });

  describe('per-user isolation', () => {
    it('never gives two users the same key', () => {
      expect(CacheKeys.nutritionTargets(userA)).not.toBe(CacheKeys.nutritionTargets(userB));
      expect(CacheKeys.achievements(userA)).not.toBe(CacheKeys.achievements(userB));
      expect(CacheKeys.progressOverview(userA, 'week')).not.toBe(
        CacheKeys.progressOverview(userB, 'week'),
      );
    });

    /**
     * The analytics prefix is what every write path deletes. It must cover all
     * of one user's cached views and none of anybody else's — the first half
     * keeps the Progress tab fresh, the second stops one user's meal log
     * evicting another's cache.
     */
    it('covers exactly the owning user’s analytics keys', () => {
      const prefix = CacheKeys.analyticsPrefix(userA);

      const owned = [
        CacheKeys.progressOverview(userA, 'week'),
        CacheKeys.progressOverview(userA, 'month'),
        CacheKeys.progressSnapshots(userA, 'week', 12),
        CacheKeys.achievements(userA),
      ];
      for (const key of owned) {
        expect(key.startsWith(prefix)).toBe(true);
      }

      const foreign = [
        CacheKeys.progressOverview(userB, 'week'),
        CacheKeys.achievements(userB),
      ];
      for (const key of foreign) {
        expect(key.startsWith(prefix)).toBe(false);
      }
    });

    it('does not sweep away non-analytics caches for the same user', () => {
      const prefix = CacheKeys.analyticsPrefix(userA);

      expect(CacheKeys.nutritionTargets(userA).startsWith(prefix)).toBe(false);
      expect(CacheKeys.food('food-1').startsWith(prefix)).toBe(false);
    });
  });

  describe('the food catalogue prefix', () => {
    it('covers both catalogue entries and rendered search pages', () => {
      const prefix = CacheKeys.foodsPrefix();

      expect(CacheKeys.food('food-1').startsWith(prefix)).toBe(true);
      expect(
        CacheKeys.foodSearch({ query: 'oats', category: null, limit: 20, offset: 0 }).startsWith(
          prefix,
        ),
      ).toBe(true);
    });
  });

  describe('search keys', () => {
    const search = (overrides: Partial<Parameters<typeof CacheKeys.foodSearch>[0]> = {}): string =>
      CacheKeys.foodSearch({ query: 'oats', category: null, limit: 20, offset: 0, ...overrides });

    it('is stable for the same parameters', () => {
      expect(search()).toBe(search());
    });

    /** Case and surrounding space are not meaningful to the search itself. */
    it('normalises the query, so equivalent searches share a cached page', () => {
      expect(search({ query: '  OATS ' })).toBe(search({ query: 'oats' }));
    });

    it.each([
      ['the query', { query: 'rice' }],
      ['the category', { category: 'grains' }],
      ['the page size', { limit: 50 }],
      ['the offset', { offset: 20 }],
    ])('changes when %s changes', (_field, override) => {
      expect(search(override)).not.toBe(search());
    });

    /**
     * A digest, not the raw query: a user-supplied string in a key can contain
     * anything, and unbounded key length is its own problem.
     */
    it('never embeds the raw user input in the key', () => {
      const key = search({ query: 'weird: value\nwith newline' });

      expect(key).not.toContain('weird');
      expect(key).not.toContain('\n');
      expect(key.length).toBeLessThan(80);
    });
  });

  describe('product keys', () => {
    it('is keyed by barcode, which is what a scan has in hand', () => {
      expect(CacheKeys.product('5000112637939')).toContain('5000112637939');
      expect(CacheKeys.product('5000112637939')).not.toBe(CacheKeys.product('5000112637940'));
    });
  });
});

describe('CacheTtl', () => {
  it('gives every lifetime a positive, finite value', () => {
    for (const [name, ttl] of Object.entries(CacheTtl)) {
      expect(typeof ttl).toBe('number');
      expect(ttl).toBeGreaterThan(0);
      expect(Number.isFinite(ttl)).toBe(true);
      expect(name).toBeTruthy();
    }
  });

  /**
   * Shared reference data is effectively static and cached for a day; anything
   * derived from a user's own writes must expire in minutes, because a write
   * they just made has to show up.
   */
  it('caches static reference data far longer than user-derived views', () => {
    expect(CacheTtl.food).toBeGreaterThanOrEqual(60 * 60);
    expect(CacheTtl.product).toBeGreaterThanOrEqual(60 * 60);

    expect(CacheTtl.progressOverview).toBeLessThanOrEqual(15 * 60);
    expect(CacheTtl.achievements).toBeLessThanOrEqual(15 * 60);
    expect(CacheTtl.nutritionTargets).toBeLessThanOrEqual(60 * 60);
  });
});
