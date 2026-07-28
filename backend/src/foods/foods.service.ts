import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { CacheKeys, CacheTtl } from '../common/cache/cache.keys';
import { CacheService } from '../common/cache/cache.service';
import { DRIZZLE, type Database } from '../database/database.constants';
import { foods } from '../database/schema';
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  type SearchFoodsDto,
} from './dto/search-foods.dto';
import { toFoodView, type FoodSearchView, type FoodView } from './food.view';

/**
 * Explicit projection of the catalogue's public columns. Keeping it separate
 * from `select(foods)` means the large generated `search_vector` never leaves
 * the database.
 */
const FOOD_COLUMNS = {
  id: foods.id,
  slug: foods.slug,
  name: foods.name,
  brand: foods.brand,
  category: foods.category,
  servingLabel: foods.servingLabel,
  servingSizeG: foods.servingSizeG,
  calories: foods.calories,
  proteinG: foods.proteinG,
  carbsG: foods.carbsG,
  fatG: foods.fatG,
  fiberG: foods.fiberG,
  sugarG: foods.sugarG,
  saturatedFatG: foods.saturatedFatG,
  sodiumMg: foods.sodiumMg,
  icon: foods.icon,
  accent: foods.accent,
} as const;

/**
 * Read access to the shared food catalogue.
 *
 * Search runs entirely in Postgres: a prefix-aware `tsquery` against the GIN
 * indexed `search_vector`, widened by a substring match so mid-word queries
 * ("burger" → "Cheeseburger") still land. Results are ranked with exact
 * name-prefix hits first, then full-text relevance, then alphabetically.
 *
 * The catalogue is read-only at runtime and identical for every user, which
 * makes it ideal to cache: both individual lookups and whole result pages are
 * memoised in Redis, so the "Add Meal" search bar answers from memory while the
 * user is still typing.
 */
@Injectable()
export class FoodsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly cache: CacheService,
  ) {}

  async search(dto: SearchFoodsDto): Promise<FoodSearchView> {
    const query = dto.q?.trim() ?? '';
    const category = dto.category ?? null;
    const limit = Math.min(dto.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const offset = dto.offset ?? 0;

    const cacheKey = CacheKeys.foodSearch({ query, category, limit, offset });

    return this.cache.getOrSet(cacheKey, CacheTtl.foodSearch, () =>
      this.runSearch(query, category, limit, offset),
    );
  }

  /**
   * A single catalogue entry. Cached aggressively — the catalogue only changes
   * when the seeder runs, and the seeder clears this cache when it does.
   */
  async getById(id: string): Promise<FoodView> {
    const cached = await this.cache.get<FoodView>(CacheKeys.food(id));
    if (cached) {
      return cached;
    }

    const [row] = await this.db.select(FOOD_COLUMNS).from(foods).where(eq(foods.id, id)).limit(1);
    if (!row) {
      throw new NotFoundException(`No food found with id "${id}".`);
    }

    const view = toFoodView(row);
    await this.cache.set(CacheKeys.food(id), view, CacheTtl.food);
    return view;
  }

  private async runSearch(
    query: string,
    category: string | null,
    limit: number,
    offset: number,
  ): Promise<FoodSearchView> {
    const tsQuery = this.toTsQuery(query);
    const likePattern = query.length > 0 ? `%${this.escapeLike(query.toLowerCase())}%` : null;
    const prefixPattern = query.length > 0 ? `${this.escapeLike(query.toLowerCase())}%` : null;

    const conditions: SQL[] = [];
    if (category) {
      conditions.push(eq(foods.category, category as never));
    }
    if (likePattern) {
      // Full-text match (prefix-aware, index-backed) OR a plain substring match,
      // which catches queries that fall inside a word rather than starting one.
      const fullText = tsQuery
        ? sql`${foods.searchVector} @@ to_tsquery('simple', ${tsQuery}) or `
        : sql``;
      conditions.push(
        sql`(${fullText}lower(${foods.name}) like ${likePattern} or lower(coalesce(${foods.brand}, '')) like ${likePattern})`,
      );
    }

    const orderBy: SQL[] = [];
    if (prefixPattern) {
      // Names that *start* with the query are what the user almost always means.
      orderBy.push(sql`(lower(${foods.name}) like ${prefixPattern}) desc`);
    }
    if (tsQuery) {
      orderBy.push(sql`ts_rank(${foods.searchVector}, to_tsquery('simple', ${tsQuery})) desc`);
    }
    orderBy.push(sql`${foods.name} asc`);

    // `count(*) over()` returns the unpaginated total alongside the page, so the
    // client gets both from a single round trip.
    const rows = await this.db
      .select({ ...FOOD_COLUMNS, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(foods)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map(toFoodView),
      total: rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  /**
   * Builds a prefix `tsquery` from free text: every alphanumeric token becomes a
   * `token:*` term, ANDed together, so "chick brea" matches "Chicken breast"
   * while the user is still typing.
   *
   * Tokens are extracted with a strict allow-list, which is also what makes this
   * safe: no `tsquery` operator character can survive into the query string.
   */
  private toTsQuery(input: string): string | null {
    const tokens = input.toLowerCase().match(/[a-z0-9]+/g);
    if (!tokens || tokens.length === 0) {
      return null;
    }
    return tokens.map((token) => `${token}:*`).join(' & ');
  }

  /** Neutralises `LIKE` wildcards so a literal `%` or `_` can be searched for. */
  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`);
  }
}
