import { ConfigService } from '@nestjs/config';
import type { CacheService } from '../common/cache/cache.service';
import { SpoonacularService } from './spoonacular.service';

/**
 * The matching logic, which is where this integration can go quietly wrong.
 *
 * A failed lookup is harmless — the plan keeps the model's estimate. A lookup
 * that *succeeds against the wrong dish* is not: it puts someone else's
 * photograph on the card, someone else's sodium figure in front of a user
 * managing their blood pressure, and someone else's recipe behind "View
 * Recipe". So these tests care far more about what is rejected than about what
 * is found.
 */

const buildConfig = (overrides: Record<string, unknown> = {}): ConfigService => {
  const values: Record<string, unknown> = {
    'spoonacular.apiKey': 'test-key',
    'spoonacular.baseUrl': 'https://api.example.com',
    'spoonacular.timeoutMs': 5_000,
    'spoonacular.maxLookupsPerPlan': 56,
    ...overrides,
  };

  return {
    get: <T>(key: string, fallback?: T): T =>
      (values[key] === undefined ? fallback : values[key]) as T,
  } as ConfigService;
};

/** A cache that never hits, so every test exercises the real request path. */
const buildCache = (): { cache: CacheService; set: jest.Mock } => {
  const set = jest.fn().mockResolvedValue(undefined);
  return {
    set,
    cache: { get: jest.fn().mockResolvedValue(null), set } as unknown as CacheService,
  };
};

/** One search result carrying a full nutrient panel. */
const result = (id: number, title: string, calories = 400) => ({
  id,
  title,
  imageType: 'jpg',
  servings: 2,
  readyInMinutes: 30,
  sourceUrl: 'https://example.com/recipe',
  sourceName: 'example.com',
  nutrition: {
    nutrients: [
      { name: 'Calories', amount: calories, unit: 'kcal' },
      { name: 'Protein', amount: 30, unit: 'g' },
      { name: 'Carbohydrates', amount: 40, unit: 'g' },
      { name: 'Fat', amount: 12, unit: 'g' },
      { name: 'Fiber', amount: 6, unit: 'g' },
      { name: 'Sodium', amount: 650, unit: 'mg' },
      { name: 'Sugar', amount: 8, unit: 'g' },
    ],
  },
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('SpoonacularService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  /** The query strings each call was made with, in order. */
  const queriesUsed = (): string[] =>
    fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('query') ?? '');

  describe('matchDish', () => {
    it('searches the end of the name rather than the whole of it', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok({ results: [result(1, 'Chicken and Vegetable Stir Fry')] }));

      await service.matchDish('High-Protein Chicken and Vegetable Stir-fry');

      // "high" and "protein" are claims a cookbook never puts in a title, and the
      // upstream query requires every term — including them finds nothing. What
      // is left is the food itself, taken from the end of the name.
      expect(queriesUsed()).toEqual(['vegetable stir fry']);
    });

    it('widens the search once when the first attempt finds nothing', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock
        .mockResolvedValueOnce(ok({ results: [] }))
        .mockResolvedValueOnce(ok({ results: [result(2, 'Roasted Vegetables')] }));

      const match = await service.matchDish('Baked cod with roasted vegetables');

      expect(queriesUsed()).toEqual(['cod roasted vegetables', 'roasted vegetables']);
      expect(match?.recipeId).toBe(2);
    });

    it('stops widening once it has candidates, so a lookup costs at most two calls', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok({ results: [result(3, 'Moosewood Lentil Soup')] }));

      await service.matchDish('Hearty lentil soup');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('scores candidates against the full name, not the query that found them', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      // Found by searching "yogurt berries", but it is a chicken salad.
      fetchMock.mockResolvedValue(ok({ results: [result(4, 'Greek Yogurt Chicken Salad')] }));

      const match = await service.matchDish('Greek yogurt with berries');

      // Two of three significant words match ("greek", "yogurt"), never "berries".
      // The caller is told exactly that and decides; it must not read as certain.
      expect(match?.confidence).toBeCloseTo(2 / 3, 5);
    });

    it('prefers the candidate that accounts for most of the name', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(
        ok({
          results: [
            result(5, 'Chocolate Oatmeal'),
            result(6, 'Banana Chia Oatmeal'),
            result(7, 'Oatmeal Cookies'),
          ],
        }),
      );

      const match = await service.matchDish('Banana chia oatmeal');

      expect(match?.recipeId).toBe(6);
      expect(match?.confidence).toBe(1);
    });

    it('reads the nutrients the platform tracks out of the panel', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok({ results: [result(8, 'Lentil Soup', 396)] }));

      const match = await service.matchDish('Lentil soup');

      expect(match?.nutrition).toEqual({
        calories: 396,
        protein: 30,
        carbs: 40,
        fat: 12,
        fiber: 6,
        saturatedFat: null,
        sugar: 8,
        sodiumMg: 650,
        cholesterolMg: null,
        potassiumMg: null,
      });
    });

    it('rejects a panel with no energy figure, which cannot be scaled to a portion', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(
        ok({ results: [{ ...result(9, 'Lentil Soup'), nutrition: { nutrients: [{ name: 'Protein', amount: 30 }] } }] }),
      );

      const match = await service.matchDish('Lentil soup');

      // Still a usable photograph and recipe — only the numbers are unusable.
      expect(match?.recipeId).toBe(9);
      expect(match?.nutrition).toBeNull();
    });

    it('caches a miss, so a dish nobody publishes is not re-searched every plan', async () => {
      const { cache, set } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok({ results: [] }));

      await expect(service.matchDish('Ackee and saltfish rundown')).resolves.toBeNull();
      expect(set).toHaveBeenCalledWith(expect.any(String), { match: null }, expect.any(Number));
    });

    it('does not cache a miss the upstream never actually answered', async () => {
      const { cache, set } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue({ ok: false, status: 402, text: async () => 'quota' });

      await expect(service.matchDish('Lentil soup')).resolves.toBeNull();
      // A spent quota says nothing about the dish. Writing a miss here would
      // blank the photograph on that dish for a week.
      expect(set).not.toHaveBeenCalled();
    });

    it('returns null rather than throwing when the food API is unreachable', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      await expect(service.matchDish('Lentil soup')).resolves.toBeNull();
    });

    it('does nothing at all when no key is configured', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig({ 'spoonacular.apiKey': '' }), cache);

      await expect(service.matchDish('Lentil soup')).resolves.toBeNull();
      expect(service.enabled).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the key as a header, so a logged URL never carries the secret', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok({ results: [result(10, 'Lentil Soup')] }));

      await service.matchDish('Lentil soup');

      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(String(url)).not.toContain('test-key');
      expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
    });
  });

  describe('getRecipe', () => {
    const information = (overrides: Record<string, unknown> = {}) => ({
      id: 42,
      title: 'Lentil Soup',
      imageType: 'jpg',
      servings: 4,
      readyInMinutes: 45,
      summary: 'Lentil Soup is a <b>gluten free</b> recipe. For <b>$1.20 per serving</b>, it covers 30% of your daily requirements. A warming, thick soup built on stock and root vegetables.',
      cuisines: ['Mediterranean'],
      diets: ['gluten free'],
      sourceName: 'example.com',
      sourceUrl: 'https://example.com/lentil-soup',
      extendedIngredients: [
        {
          name: 'red lentils',
          nameClean: 'red lentils',
          amount: 8,
          unit: 'ounces',
          meta: ['rinsed'],
          measures: { metric: { amount: 226.796, unitShort: 'g' } },
        },
      ],
      analyzedInstructions: [
        {
          name: '',
          steps: [
            { step: 'Sweat the onions and carrots in oil, until soft but not coloured.', length: { number: 8, unit: 'minutes' } },
            { step: 'Add the lentils and stock and simmer until tender.', length: { number: 1, unit: 'hours' } },
          ],
        },
      ],
      ...overrides,
    });

    it('translates a published method into the platform’s own recipe shape', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok(information()));

      const recipe = await service.getRecipe(42);

      expect(recipe).toMatchObject({
        recipeId: 42,
        cuisine: 'Mediterranean',
        servings: 4,
        sourceName: 'example.com',
      });
      // Metric, rounded to something a person would write on a list.
      expect(recipe?.ingredients[0]).toEqual({
        name: 'Red lentils',
        quantity: '227 g',
        note: 'rinsed',
      });
    });

    it('titles an untitled step from its own opening clause', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok(information()));

      const recipe = await service.getRecipe(42);

      expect(recipe?.steps[0].title).toBe('Sweat the onions and carrots in oil');
      expect(recipe?.steps[0].minutes).toBe(8);
      // Hours are normalised, so a step never reads as "1 min" for an hour's work.
      expect(recipe?.steps[1].minutes).toBe(60);
    });

    it('strips the markup, the pricing and the figures the app already shows properly', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok(information()));

      const summary = (await service.getRecipe(42))?.summary ?? '';

      expect(summary).not.toContain('<b>');
      expect(summary).not.toContain('$1.20');
      expect(summary).not.toContain('daily requirements');
      // What the reader actually came for survives.
      expect(summary).toContain('A warming, thick soup built on stock and root vegetables.');
    });

    it('splits a total time when the source reports only "ready in"', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok(information({ preparationMinutes: null, cookingMinutes: null })));

      const recipe = await service.getRecipe(42);

      // Approximated, but the total a cook plans around stays exact.
      expect((recipe?.prepMinutes ?? 0) + (recipe?.cookMinutes ?? 0)).toBe(45);
    });

    it('declines a "recipe" that carries no method, handing the dish back to the model', async () => {
      const { cache } = buildCache();
      const service = new SpoonacularService(buildConfig(), cache);
      fetchMock.mockResolvedValue(ok(information({ analyzedInstructions: [] })));

      await expect(service.getRecipe(42)).resolves.toBeNull();
    });
  });
});
