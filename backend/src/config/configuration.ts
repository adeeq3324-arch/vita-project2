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
  push: {
    enabled: toBool(process.env.PUSH_ENABLED),
    expoPushUrl: process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send',
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
    timeoutMs: toInt(process.env.PUSH_TIMEOUT_MS, 15_000),
  },
});
