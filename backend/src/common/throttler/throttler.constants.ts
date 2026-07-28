/**
 * Rate-limiting vocabulary, shared by the two guards, the storage and the
 * route decorators.
 */

/** DI token for the Redis-backed throttler storage. */
export const THROTTLER_STORAGE = Symbol('THROTTLER_STORAGE');

/**
 * Name of the coarse per-IP shield evaluated *before* authentication.
 *
 * One bucket for the whole API rather than one per route: its job is to stop a
 * flood reaching the auth guard (and therefore Supabase), which a per-route
 * limit would not do — an attacker would simply spread the flood across routes.
 */
export const THROTTLER_GLOBAL = 'global';

/**
 * Name of the per-caller limit evaluated *after* authentication. Route-scoped,
 * so every endpoint gets its own budget and `@Throttle` overrides on one route
 * cannot spend another's.
 */
export const THROTTLER_DEFAULT = 'default';

/**
 * Name of the shared budget for endpoints that call the generative model.
 *
 * Deliberately *not* route-scoped: a model call costs real money wherever it is
 * made, so scans, coach turns and plan generations draw on one allowance. A
 * per-route limit would let a caller spend the same budget several times over
 * simply by alternating endpoints.
 */
export const THROTTLER_AI = 'ai';

/**
 * Metadata key marking a handler as model-backed. The `ai` throttler skips
 * every request that does not carry it, so ordinary endpoints cost one Redis
 * round-trip rather than two.
 */
export const AI_ROUTE_KEY = 'vital:rate-limit:ai-route';

/** Root for every rate-limit key. Versioned so limits can be retired in one step. */
export const RATE_LIMIT_KEY_ROOT = 'vital:v1:rl';
