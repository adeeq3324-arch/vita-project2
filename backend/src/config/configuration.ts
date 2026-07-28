/**
 * Typed application configuration, sourced exclusively from environment
 * variables. No secret or connection detail is ever hardcoded — every value
 * originates from the process environment (validated in `env.validation.ts`).
 */
export interface AppConfiguration {
  env: 'development' | 'test' | 'production';
  app: {
    name: string;
    port: number;
  };
  logging: {
    level: string;
  };
  database: {
    url: string;
    ssl: boolean;
    maxConnections: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
  };
  supabase: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    /** Deep link the password-reset email should send the user to. */
    passwordResetRedirectUrl?: string;
    /** Storage bucket scan images are uploaded to. */
    scansBucket: string;
  };
  /**
   * Generative-model access. Deliberately provider-agnostic: the runtime picks
   * an adapter from `providerId` alone, and every other value is a plain
   * connection detail. Changing model vendor is an environment change, never a
   * code change.
   */
  ai: {
    providerId?: string;
    baseUrl?: string;
    modelName?: string;
    apiKey?: string;
    /** Per-request ceiling, milliseconds. */
    timeoutMs: number;
    /** Retries for transient (network / 5xx / rate-limit) failures. */
    maxRetries: number;
  };
  /**
   * Request rate limiting.
   *
   * Three independent budgets, each tunable without a deploy because the right
   * number is a property of the traffic an environment actually sees:
   *
   *  - `global` — coarse per-IP shield applied before authentication.
   *  - `default` — per-user, per-route allowance for ordinary traffic.
   *  - `ai` — one shared hourly budget for every endpoint that calls the model.
   *
   * `trustProxy` decides where the client address is read from. It must match
   * the deployment: too permissive and a caller can spoof `X-Forwarded-For` to
   * evade the shield entirely, too strict and every request behind a load
   * balancer shares the balancer's address as one bucket.
   */
  rateLimit: {
    enabled: boolean;
    trustProxy: string | number | boolean;
    global: { limit: number; ttlSeconds: number; blockSeconds: number };
    default: { limit: number; ttlSeconds: number; blockSeconds: number };
    ai: { limit: number; ttlSeconds: number; blockSeconds: number };
  };
  /**
   * Operational visibility: error tracking and metrics.
   *
   * Both are optional and off unless configured, so a development or CI run
   * needs no monitoring credentials — the code paths are identical either way,
   * the events simply go nowhere.
   */
  observability: {
    /** Sentry-compatible ingest DSN. Error tracking is disabled when absent. */
    sentryDsn?: string;
    /** Deployment identifier attached to every reported event. */
    environment: string;
    /** Release/version attached to every reported event. */
    release?: string;
    /** Fraction of errors forwarded, 0–1. Lets a noisy incident be sampled down. */
    sampleRate: number;
    /** Per-request ceiling for a report, milliseconds. */
    timeoutMs: number;
    /** Whether `/metrics` is exposed for scraping. */
    metricsEnabled: boolean;
    /** Bearer token `/metrics` requires. Unauthenticated when absent. */
    metricsToken?: string;
  };
  /**
   * Push notification delivery, used by reminders and achievement unlocks.
   *
   * `enabled` is the master switch: with it off (the default) reminders still fire
   * on schedule and are recorded as sent, they simply produce no push. That keeps
   * a development or CI environment from needing push credentials at all, while
   * leaving the scheduling path exercised exactly as it runs in production.
   */
  push: {
    enabled: boolean;
    /** Expo push endpoint. Overridable so a proxy or a test double can stand in. */
    expoPushUrl: string;
    /** Optional Expo access token, required only when push security is enforced. */
    expoAccessToken?: string;
    /** Per-request ceiling, milliseconds. */
    timeoutMs: number;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value: string | undefined): boolean => value === 'true' || value === '1';

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Express's `trust proxy` setting, which accepts three different kinds of value
 * and means something different for each.
 *
 * A number is a hop count, a boolean turns the header on or off wholesale, and
 * anything else is a subnet or preset name (`loopback`, `uniquelocal`, a CIDR).
 * The default trusts nothing: a direct deployment must not honour a client's
 * own `X-Forwarded-For`, or the per-IP shield could be evaded by setting one
 * header.
 */
const parseTrustProxy = (value: string | undefined): string | number | boolean => {
  if (!value) {
    return false;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  const hops = Number.parseInt(value, 10);
  return String(hops) === value.trim() ? hops : value;
};

export default (): AppConfiguration => ({
  env: (process.env.NODE_ENV as AppConfiguration['env']) ?? 'development',
  app: {
    name: process.env.APP_NAME ?? 'VITAL AI API',
    port: toInt(process.env.PORT, 3000),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  database: {
    url: process.env.DATABASE_URL as string,
    ssl: toBool(process.env.DATABASE_SSL),
    maxConnections: toInt(process.env.DATABASE_MAX_CONNECTIONS, 10),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: toBool(process.env.REDIS_TLS),
  },
  supabase: {
    url: process.env.SUPABASE_URL || undefined,
    anonKey: process.env.SUPABASE_ANON_KEY || undefined,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    passwordResetRedirectUrl: process.env.SUPABASE_PASSWORD_RESET_REDIRECT_URL || undefined,
    scansBucket: process.env.SUPABASE_SCANS_BUCKET ?? 'scans',
  },
  ai: {
    providerId: process.env.AI_PROVIDER_ID || undefined,
    baseUrl: process.env.AI_BASE_URL || undefined,
    modelName: process.env.AI_MODEL_NAME || undefined,
    apiKey: process.env.AI_API_KEY || undefined,
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 60_000),
    maxRetries: toInt(process.env.AI_MAX_RETRIES, 2),
  },
  rateLimit: {
    // On unless explicitly disabled: a limiter that defaults to off is one that
    // is missing in production the first time nobody sets the variable.
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    global: {
      limit: toInt(process.env.RATE_LIMIT_GLOBAL_LIMIT, 600),
      ttlSeconds: toInt(process.env.RATE_LIMIT_GLOBAL_TTL_SECONDS, 60),
      blockSeconds: toInt(process.env.RATE_LIMIT_GLOBAL_BLOCK_SECONDS, 60),
    },
    default: {
      limit: toInt(process.env.RATE_LIMIT_DEFAULT_LIMIT, 120),
      ttlSeconds: toInt(process.env.RATE_LIMIT_DEFAULT_TTL_SECONDS, 60),
      blockSeconds: toInt(process.env.RATE_LIMIT_DEFAULT_BLOCK_SECONDS, 60),
    },
    ai: {
      limit: toInt(process.env.RATE_LIMIT_AI_LIMIT, 60),
      ttlSeconds: toInt(process.env.RATE_LIMIT_AI_TTL_SECONDS, 3600),
      blockSeconds: toInt(process.env.RATE_LIMIT_AI_BLOCK_SECONDS, 300),
    },
  },
  observability: {
    sentryDsn: process.env.SENTRY_DSN || undefined,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    sampleRate: toFloat(process.env.SENTRY_SAMPLE_RATE, 1),
    timeoutMs: toInt(process.env.SENTRY_TIMEOUT_MS, 5_000),
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    metricsToken: process.env.METRICS_TOKEN || undefined,
  },
  push: {
    enabled: toBool(process.env.PUSH_ENABLED),
    expoPushUrl: process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send',
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
    timeoutMs: toInt(process.env.PUSH_TIMEOUT_MS, 15_000),
  },
});
