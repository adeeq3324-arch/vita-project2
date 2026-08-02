import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheKeys, CacheTtl } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import type {
  DishMatch,
  DishNutrition,
  SourcedIngredient,
  SourcedRecipe,
  SourcedStep,
} from './spoonacular.types';

/**
 * The food knowledge base behind a generated plan.
 *
 * The model decides *what* this person should eat and *when*; everything a
 * planner cannot honestly invent comes from here — the photograph of the dish,
 * its measured macro composition, and a method somebody actually published and
 * cooked.
 *
 * Two rules govern the whole class:
 *
 *  - **Nothing here ever throws.** A lookup that fails, times out, or comes back
 *    unrecognisable resolves to `null`, and the caller keeps the model's own
 *    estimate. A plan is not allowed to fail because a third-party food API had
 *    a bad minute.
 *  - **Nothing here decides.** The service reports how well a title matched and
 *    stops; whether that is good enough to overwrite a meal's macros is a
 *    judgement the meal-plan service makes, because the answer differs by use.
 *
 * Results are cached across all users rather than per user. Generated plans name
 * the same few hundred ordinary dishes over and over, so one cached "grilled
 * chicken salad" serves every plan that suggests one — which is what keeps a
 * daily-metered quota viable for a whole user base.
 */

/** Candidates to weigh per search. More costs nothing extra and matches better. */
const SEARCH_RESULTS = 5;

/**
 * Words that carry no identity in a dish name.
 *
 * Two jobs, both essential. Scoring counts how much of a requested name a title
 * accounts for, and without this "with", "and" and "of" would let almost any
 * title score well against almost any dish. Searching is stricter still — the
 * upstream query is an AND over every term — so a nutritional claim like
 * "High-Protein" in a generated name would demand the word "protein" appear in
 * a published recipe's title, and nothing would ever be found.
 */
const NOISE_WORDS = new Set([
  // Grammar.
  'a',
  'an',
  'and',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'without',
  'served',
  'side',
  'style',
  // Claims a planner adds and a cookbook does not.
  'high',
  'low',
  'protein',
  'packed',
  'rich',
  'super',
  'lean',
  'light',
  'fresh',
  'homemade',
  'easy',
  'quick',
  'simple',
  'classic',
  'hearty',
  'healthy',
  'nutritious',
  'balanced',
  'wholesome',
  // Qualifiers that describe the flour or the cut rather than the dish.
  'whole',
  'grain',
  'wheat',
]);

/**
 * How many trailing words each search attempt keeps.
 *
 * A dish name reads modifier-first and head-noun-last — "Grilled Chicken Quinoa
 * and Spinach **Salad**" — so dropping from the front is dropping the least
 * identifying part. Searching the full name finds nothing in practice: the
 * upstream query requires every term, and no published recipe is titled the way
 * a planner describes a meal.
 *
 * Two attempts, not more. Every rung is a metered request, a week holds dozens
 * of distinct dishes, and measurement showed every match good enough to *use*
 * landing within these two — broader rungs only ever turned up dishes the
 * confidence check then threw away.
 */
const SEARCH_WIDTHS = [3, 2] as const;

/** Where each figure the platform tracks lives in the source's nutrient list. */
const NUTRIENT_NAMES = {
  calories: 'calories',
  protein: 'protein',
  carbs: 'carbohydrates',
  fat: 'fat',
  fiber: 'fiber',
  saturatedFat: 'saturated fat',
  sugar: 'sugar',
  sodiumMg: 'sodium',
  cholesterolMg: 'cholesterol',
  potassiumMg: 'potassium',
} as const;

@Injectable()
export class SpoonacularService {
  private readonly logger = new Logger(SpoonacularService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  /**
   * True when a key is configured. Callers check this to skip the enrichment
   * step wholesale rather than making a run of lookups that will each fail.
   */
  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  /** Lookups one plan generation may spend, from configuration. */
  get maxLookupsPerPlan(): number {
    return this.config.get<number>('spoonacular.maxLookupsPerPlan') ?? 0;
  }

  /**
   * Finds the published dish that best answers a name the model invented.
   *
   * Two things make this harder than it sounds, and the method is shaped by
   * both.
   *
   * *Finding candidates at all.* The upstream query is an AND over every term,
   * and a planner writes "High-Protein Banana Chia Oatmeal" where a cookbook
   * writes "Chocolate Oatmeal". Searching the name verbatim returns nothing —
   * measurably, for every dish tried. So the search narrows to the end of the
   * name, where the food itself is, and widens once if that finds nothing.
   *
   * *Trusting them.* The source always returns *something* for a broad enough
   * query — a blueberry cobbler for overnight oats, taquitos for a turkey wrap.
   * So the candidates are scored back against the **full** original name, not
   * the shortened query that found them, and the score travels out with the
   * match. That is what makes a loose match visibly loose to the caller rather
   * than silently authoritative.
   *
   * Misses are cached as firmly as hits. A dish the source does not know is a
   * permanent fact about that dish, and re-asking on every plan would spend the
   * day's quota discovering the same nothing.
   */
  async matchDish(dishName: string): Promise<DishMatch | null> {
    const name = dishName.trim();
    if (!this.enabled || name.length === 0) {
      return null;
    }

    const cached = await this.cache.get<{ match: DishMatch | null }>(CacheKeys.dishMatch(name));
    if (cached) {
      return cached.match;
    }

    let match: DishMatch | null = null;
    let answered = false;

    for (const query of this.queries(name)) {
      const response = await this.request<SearchResponse>('/recipes/complexSearch', {
        query,
        number: String(SEARCH_RESULTS),
        addRecipeNutrition: 'true',
        // A dish with no published method is of no use to the recipe screen, and
        // excluding those up front means the match a plan stores is one that can
        // still answer "how do I cook this" a week later.
        instructionsRequired: 'true',
      });

      if (!response) {
        continue;
      }
      answered = true;

      match = this.bestMatch(name, response.results ?? []);
      if (match) {
        break;
      }
    }

    // A failed request is not evidence about the dish, so a miss is only written
    // to the cache when at least one attempt actually got an answer.
    if (answered) {
      await this.cache.set(CacheKeys.dishMatch(name), { match }, CacheTtl.dishMatch);
    }
    return match;
  }

  /**
   * The published method for a dish already matched.
   *
   * Separate from {@link matchDish} because the two are asked at different
   * times: a plan matches fifty-six dishes when it is generated and fetches a
   * method only for the handful somebody decides to cook.
   */
  async getRecipe(recipeId: number): Promise<SourcedRecipe | null> {
    if (!this.enabled) {
      return null;
    }

    const cached = await this.cache.get<{ recipe: SourcedRecipe | null }>(
      CacheKeys.sourcedRecipe(recipeId),
    );
    if (cached) {
      return cached.recipe;
    }

    const response = await this.request<RecipeInformation>(
      `/recipes/${recipeId}/information`,
      { includeNutrition: 'false' },
    );
    if (!response) {
      return null;
    }

    const recipe = this.toSourcedRecipe(response);
    await this.cache.set(
      CacheKeys.sourcedRecipe(recipeId),
      { recipe },
      CacheTtl.sourcedRecipe,
    );
    return recipe;
  }

  // ── matching ──────────────────────────────────────────────────────────────

  /**
   * The search terms to try for a dish, narrowest first.
   *
   * See {@link SEARCH_WIDTHS} for why the terms come off the end of the name and
   * why there are only two attempts. Duplicates collapse, so a name already
   * short enough costs exactly one request.
   */
  private queries(name: string): string[] {
    const significant = this.significantWords(name);
    if (significant.length === 0) {
      // Nothing but claims and grammar. The raw name is a poor query, but it is
      // the only information there is.
      return [name];
    }

    const attempts = SEARCH_WIDTHS.map((width) => significant.slice(-width).join(' '));
    return [...new Set(attempts)];
  }

  /**
   * Picks the candidate whose title accounts for most of the requested name.
   *
   * Ties go to the earlier result, which preserves the source's own relevance
   * ordering as the tie-breaker rather than replacing it.
   */
  private bestMatch(query: string, results: readonly SearchResult[]): DishMatch | null {
    let best: DishMatch | null = null;

    for (const result of results) {
      if (typeof result.id !== 'number' || !result.title) {
        continue;
      }

      const confidence = this.score(query, result.title);
      if (best !== null && confidence <= best.confidence) {
        continue;
      }

      best = {
        recipeId: result.id,
        title: result.title,
        imageUrl: this.imageUrl(result.id, result.imageType) ?? result.image ?? null,
        servings: this.positive(result.servings, 1),
        readyInMinutes: this.positive(result.readyInMinutes, 0),
        sourceUrl: result.sourceUrl ?? null,
        sourceName: result.sourceName ?? result.creditsText ?? null,
        nutrition: this.toNutrition(result.nutrition?.nutrients),
        confidence,
      };
    }

    return best;
  }

  /**
   * How much of the requested dish name a title accounts for, 0–1.
   *
   * Deliberately asymmetric: it measures the *query's* words found in the title,
   * not the reverse. A published title carries extras the plan never asked for
   * ("Grandma's Garlic Lime Grilled Chicken Salad for Two"), and penalising
   * those would reject good matches for being descriptive. What must not happen
   * is the opposite — a title that answers only half of what was asked for.
   */
  private score(query: string, title: string): number {
    const wanted = this.significantWords(query);
    if (wanted.length === 0) {
      return 0;
    }

    const found = new Set(this.significantWords(title));
    const hits = wanted.filter((word) => found.has(word)).length;
    return hits / wanted.length;
  }

  /** Lower-cased words a reader would use to identify the dish. */
  private significantWords(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !NOISE_WORDS.has(word));
  }

  // ── translation ───────────────────────────────────────────────────────────

  /** Reads the nutrients the platform tracks out of the source's flat list. */
  private toNutrition(nutrients: readonly Nutrient[] | undefined): DishNutrition | null {
    if (!Array.isArray(nutrients) || nutrients.length === 0) {
      return null;
    }

    const byName = new Map(
      nutrients
        .filter((nutrient) => typeof nutrient?.name === 'string')
        .map((nutrient) => [nutrient.name.trim().toLowerCase(), nutrient.amount]),
    );

    const read = (key: keyof typeof NUTRIENT_NAMES): number | null => {
      const amount = byName.get(NUTRIENT_NAMES[key]);
      return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
        ? Math.round(amount * 10) / 10
        : null;
    };

    const calories = read('calories');
    // Energy is the anchor every other figure is judged against; a panel without
    // it cannot be scaled to a portion, so it is no more usable than no panel.
    if (calories === null || calories <= 0) {
      return null;
    }

    return {
      calories,
      protein: read('protein') ?? 0,
      carbs: read('carbs') ?? 0,
      fat: read('fat') ?? 0,
      fiber: read('fiber') ?? 0,
      saturatedFat: read('saturatedFat'),
      sugar: read('sugar'),
      sodiumMg: read('sodiumMg'),
      cholesterolMg: read('cholesterolMg'),
      potassiumMg: read('potassiumMg'),
    };
  }

  private toSourcedRecipe(recipe: RecipeInformation): SourcedRecipe | null {
    const steps = this.toSteps(recipe.analyzedInstructions);
    // A "recipe" with no method is a photograph and a shopping list. Returning
    // null hands the dish back to the model, which will at least describe how to
    // cook it — the one thing the screen exists to answer.
    if (steps.length === 0) {
      return null;
    }

    const { prepMinutes, cookMinutes } = this.toTimings(recipe);

    return {
      recipeId: recipe.id,
      title: recipe.title ?? '',
      imageUrl: this.imageUrl(recipe.id, recipe.imageType) ?? recipe.image ?? null,
      summary: this.toSummary(recipe.summary),
      cuisine: recipe.cuisines?.[0]?.trim() ?? '',
      servings: this.positive(recipe.servings, 1),
      prepMinutes,
      cookMinutes,
      ingredients: this.toIngredients(recipe.extendedIngredients),
      steps,
      tips: this.toTips(recipe),
      sourceUrl: recipe.sourceUrl ?? null,
      sourceName: recipe.sourceName ?? recipe.creditsText ?? null,
    };
  }

  /**
   * Splits the total time into prep and cook.
   *
   * Most published recipes report only "ready in", so the split is inferred at a
   * third/two-thirds rather than left at zero — a timing card that reads "0 min
   * prep, 30 min cook" for a salad is worse than an honest approximation, and
   * the total, which is the number a cook actually plans around, is exact either
   * way.
   */
  private toTimings(recipe: RecipeInformation): { prepMinutes: number; cookMinutes: number } {
    const prep = this.positive(recipe.preparationMinutes, 0);
    const cook = this.positive(recipe.cookingMinutes, 0);
    if (prep > 0 || cook > 0) {
      return { prepMinutes: prep, cookMinutes: cook };
    }

    const total = this.positive(recipe.readyInMinutes, 0);
    return { prepMinutes: Math.round(total / 3), cookMinutes: total - Math.round(total / 3) };
  }

  private toIngredients(
    ingredients: readonly ExtendedIngredient[] | undefined,
  ): SourcedIngredient[] {
    if (!Array.isArray(ingredients)) {
      return [];
    }

    return ingredients
      .filter((ingredient) => typeof ingredient?.name === 'string' && ingredient.name.length > 0)
      .map((ingredient) => ({
        name: this.capitalise(ingredient.nameClean?.trim() || ingredient.name.trim()),
        quantity: this.toQuantity(ingredient),
        // The source's `meta` is the preparation the line calls for — "finely
        // diced", "drained" — which is exactly the note the shopping list shows.
        note: ingredient.meta?.length ? ingredient.meta.join(', ') : null,
      }));
  }

  /** Metric where the source has it, since the platform stores and shows metric. */
  private toQuantity(ingredient: ExtendedIngredient): string {
    const metric = ingredient.measures?.metric;
    const amount = metric?.amount ?? ingredient.amount;
    const unit = (metric?.unitShort ?? ingredient.unit ?? '').trim();

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return unit || 'to taste';
    }

    // Whole numbers below ten stay whole ("2 tbsp"); everything else rounds to
    // one decimal, so "226.796 g" reads as "226.8 g" rather than as a lab result.
    const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
    return unit ? `${rounded} ${unit}` : String(rounded);
  }

  /**
   * Flattens the source's grouped instructions into one ordered method.
   *
   * Groups exist for recipes written in parts ("for the sauce", "for the base"),
   * and their names are kept as the step titles they are — a cook following
   * along needs to know which part they are on.
   */
  private toSteps(groups: readonly InstructionGroup[] | undefined): SourcedStep[] {
    if (!Array.isArray(groups)) {
      return [];
    }

    const steps: SourcedStep[] = [];

    for (const group of groups) {
      const part = group?.name?.trim();

      for (const step of group?.steps ?? []) {
        const instruction = step?.step?.replace(/\s+/g, ' ').trim();
        if (!instruction) {
          continue;
        }

        steps.push({
          title: part ? this.capitalise(part) : this.toStepTitle(instruction),
          instruction,
          minutes: this.toStepMinutes(step.length),
        });
      }
    }

    return steps;
  }

  /**
   * A short title for a step that came without one.
   *
   * The first clause of an instruction is almost always what the step achieves
   * — "Mix the juices, oil and spices in a small bowl" — so it is taken as the
   * heading and the full text stays below it. Truncated at a word boundary so a
   * long opening clause never produces a title that runs off the card.
   */
  private toStepTitle(instruction: string): string {
    const clause = instruction.split(/[.,;:]/)[0]?.trim() ?? instruction;
    if (clause.length <= 48) {
      return this.capitalise(clause);
    }

    const cut = clause.slice(0, 48);
    const boundary = cut.lastIndexOf(' ');
    return this.capitalise(`${boundary > 20 ? cut.slice(0, boundary) : cut}…`);
  }

  /** A step's own duration, in minutes, when the source timed it. */
  private toStepMinutes(length: StepLength | undefined): number | null {
    const value = length?.number;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    return length?.unit?.toLowerCase().startsWith('hour') ? Math.round(value * 60) : Math.round(value);
  }

  /**
   * The description shown under "About This Dish".
   *
   * The source's summary is marketing HTML that opens with pricing and daily
   * percentages the app already shows properly elsewhere, so only the sentences
   * that describe the food itself are kept, plain and short.
   */
  private toSummary(summary: string | undefined): string {
    if (!summary) {
      return '';
    }

    const plain = summary
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const sentences = plain
      .split(/(?<=\.)\s+/)
      .filter((sentence) => !/\$|per serving|daily requirements|calories|foodies/i.test(sentence))
      .slice(0, 3)
      .join(' ');

    const chosen = sentences.length > 0 ? sentences : plain;
    return chosen.length > 400 ? `${chosen.slice(0, 397).trimEnd()}…` : chosen;
  }

  /**
   * Practical notes about the dish, from what the source states rather than
   * from anything invented here.
   *
   * Dietary facts and yield are what a cook needs to know before starting and
   * cannot read off the method, which is what the tips section is for.
   */
  private toTips(recipe: RecipeInformation): string[] {
    const tips: string[] = [];

    const diets = recipe.diets?.filter((diet) => diet.trim().length > 0) ?? [];
    if (diets.length > 0) {
      tips.push(`Suitable for: ${diets.map((diet) => this.capitalise(diet)).join(', ')}.`);
    }

    const servings = this.positive(recipe.servings, 1);
    if (servings > 1) {
      tips.push(
        `The method below makes ${servings} servings — your plan counts one of them, ` +
          'so keep the rest for later or scale the ingredients down.',
      );
    }

    if (recipe.sourceName || recipe.creditsText) {
      tips.push(`Recipe published by ${recipe.sourceName ?? recipe.creditsText}.`);
    }

    return tips;
  }

  // ── transport ─────────────────────────────────────────────────────────────

  /**
   * One GET against the food API, returning `null` for anything that is not a
   * usable answer.
   *
   * There is no retry. Every caller has a working fallback — the model's own
   * estimate — so a slow or unhappy upstream should cost the plan one timeout
   * and not three, and a 402 (daily quota spent) will not become usable by being
   * asked again a second later.
   */
  private async request<T>(path: string, params: Record<string, string>): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          // Kept out of the query string so a logged URL never carries the key.
          'x-api-key': this.apiKey,
        },
        signal: AbortSignal.timeout(this.config.get<number>('spoonacular.timeoutMs') ?? 10_000),
      });
    } catch (error) {
      this.logger.warn(`Food API unreachable for ${path}: ${this.describe(error)}`);
      return null;
    }

    if (!response.ok) {
      // 402 is the daily quota, and it will be 402 for the rest of the day. It
      // is logged at warn like any other failure but named explicitly, because
      // "plans stopped having photographs" has a very different remedy from a
      // transient outage.
      this.logger.warn(
        response.status === 402
          ? 'Food API daily quota is spent — plans will fall back to estimated nutrition.'
          : `Food API responded ${response.status} for ${path}.`,
      );
      return null;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(`Food API returned unreadable JSON for ${path}: ${this.describe(error)}`);
      return null;
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private get apiKey(): string {
    return this.config.get<string>('spoonacular.apiKey')?.trim() ?? '';
  }

  private get baseUrl(): string {
    return this.config.get<string>('spoonacular.baseUrl') ?? 'https://api.spoonacular.com';
  }

  /**
   * The source's own CDN URL at a size worth putting behind a detail hero.
   *
   * Search results carry a 312px thumbnail, which is fine on a card and visibly
   * soft filling the top of a phone screen; the CDN serves the same photograph
   * at 636px under a predictable name.
   */
  private imageUrl(recipeId: number, imageType: string | undefined): string | null {
    const extension = imageType?.trim().toLowerCase();
    return extension && /^[a-z]{3,4}$/.test(extension)
      ? `https://img.spoonacular.com/recipes/${recipeId}-636x393.${extension}`
      : null;
  }

  private positive(value: number | null | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.round(value)
      : fallback;
  }

  private capitalise(value: string): string {
    return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

// ── the shapes the source answers with ──────────────────────────────────────
// Declared here and nowhere else: every one of them is translated into this
// platform's own vocabulary before it leaves the service.

interface Nutrient {
  name: string;
  amount?: number;
  unit?: string;
}

interface SearchResult {
  id: number;
  title?: string;
  image?: string;
  imageType?: string;
  servings?: number;
  readyInMinutes?: number;
  sourceUrl?: string;
  sourceName?: string;
  creditsText?: string;
  nutrition?: { nutrients?: Nutrient[] };
}

interface SearchResponse {
  results?: SearchResult[];
}

interface IngredientMeasure {
  amount?: number;
  unitShort?: string;
}

interface ExtendedIngredient {
  name: string;
  nameClean?: string;
  amount?: number;
  unit?: string;
  meta?: string[];
  measures?: { metric?: IngredientMeasure; us?: IngredientMeasure };
}

interface StepLength {
  number?: number;
  unit?: string;
}

interface InstructionStep {
  step?: string;
  length?: StepLength;
}

interface InstructionGroup {
  name?: string;
  steps?: InstructionStep[];
}

interface RecipeInformation {
  id: number;
  title?: string;
  image?: string;
  imageType?: string;
  summary?: string;
  servings?: number;
  readyInMinutes?: number;
  preparationMinutes?: number | null;
  cookingMinutes?: number | null;
  cuisines?: string[];
  diets?: string[];
  sourceUrl?: string;
  sourceName?: string;
  creditsText?: string;
  extendedIngredients?: ExtendedIngredient[];
  analyzedInstructions?: InstructionGroup[];
}
