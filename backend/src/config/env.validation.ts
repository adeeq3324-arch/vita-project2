import * as Joi from 'joi';

/**
 * Fail-fast validation for all environment variables. The application refuses
 * to boot if a required secret/connection value is missing or malformed, so no
 * misconfigured instance ever reaches production.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  APP_NAME: Joi.string().default('VITAL AI API'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  // Database (Supabase Postgres)
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DATABASE_SSL: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
  DATABASE_MAX_CONNECTIONS: Joi.number().min(1).max(100).default(10),

  // Redis (cache + BullMQ queue backend)
  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_TLS: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),

  // Supabase (Auth + Storage) — consumed by feature modules in later phases.
  // `.allow('')` so a present-but-empty value (e.g. the empty defaults compose
  // injects before these secrets are configured) validates as "unset" rather
  // than failing boot, mirroring REDIS_PASSWORD above.
  SUPABASE_URL: Joi.string().uri().allow('').optional(),
  SUPABASE_ANON_KEY: Joi.string().allow('').optional(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').optional(),
  // Optional deep link target for the password-reset email.
  SUPABASE_PASSWORD_RESET_REDIRECT_URL: Joi.string().uri().allow('').optional(),
  // Storage bucket scan images are written to.
  SUPABASE_SCANS_BUCKET: Joi.string().allow('').default('scans'),

  // ----- Generative model access (Phase 3) -----
  // Intentionally generic. `AI_PROVIDER_ID` selects an adapter at runtime; the
  // set of accepted ids is owned by the provider registry rather than duplicated
  // here, so adding an adapter never means editing this file. The AI module
  // validates the id and the required connection values at boot and refuses to
  // start on an unknown or incomplete configuration.
  AI_PROVIDER_ID: Joi.string().allow('').optional(),
  AI_BASE_URL: Joi.string().uri().allow('').optional(),
  AI_MODEL_NAME: Joi.string().allow('').optional(),
  AI_API_KEY: Joi.string().allow('').optional(),
  AI_TIMEOUT_MS: Joi.number().min(1000).max(600_000).default(60_000),
  AI_MAX_RETRIES: Joi.number().min(0).max(5).default(2),

  // ----- Spoonacular (food photography, measured nutrition, published recipes) -----
  // Optional throughout. Absent a key the meal-plan enrichment step is skipped
  // and plans fall back to the model's own estimates, so no environment is
  // forced to hold a food-data subscription just to boot.
  SPOONACULAR_API_KEY: Joi.string().allow('').optional(),
  SPOONACULAR_BASE_URL: Joi.string().uri().allow('').default('https://api.spoonacular.com'),
  SPOONACULAR_TIMEOUT_MS: Joi.number().min(1000).max(60_000).default(10_000),
  // A week is at most 56 dishes, so that is the ceiling this can usefully take.
  SPOONACULAR_MAX_LOOKUPS_PER_PLAN: Joi.number().min(0).max(56).default(56),

  // ----- Rate limiting (Phase 5) -----
  // Enabled unless explicitly switched off, so an environment that never sets
  // these variables is still protected. Every budget is tunable per environment
  // because the correct number depends on the traffic, not on the code.
  RATE_LIMIT_ENABLED: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),
  // Where the client address is read from. Must match the deployment topology:
  // `false` for a directly exposed service, a hop count or CIDR behind a proxy.
  TRUST_PROXY: Joi.string().allow('').optional(),

  RATE_LIMIT_GLOBAL_LIMIT: Joi.number().min(1).default(600),
  RATE_LIMIT_GLOBAL_TTL_SECONDS: Joi.number().min(1).default(60),
  RATE_LIMIT_GLOBAL_BLOCK_SECONDS: Joi.number().min(1).default(60),

  RATE_LIMIT_DEFAULT_LIMIT: Joi.number().min(1).default(120),
  RATE_LIMIT_DEFAULT_TTL_SECONDS: Joi.number().min(1).default(60),
  RATE_LIMIT_DEFAULT_BLOCK_SECONDS: Joi.number().min(1).default(60),

  RATE_LIMIT_AI_LIMIT: Joi.number().min(1).default(60),
  RATE_LIMIT_AI_TTL_SECONDS: Joi.number().min(1).default(3600),
  RATE_LIMIT_AI_BLOCK_SECONDS: Joi.number().min(1).default(300),

  // ----- Observability (Phase 5) -----
  // Both channels are optional: absent a DSN nothing is reported, and metrics
  // can be switched off for an environment that has nothing scraping them.
  SENTRY_DSN: Joi.string().uri().allow('').optional(),
  SENTRY_ENVIRONMENT: Joi.string().allow('').optional(),
  SENTRY_RELEASE: Joi.string().allow('').optional(),
  SENTRY_SAMPLE_RATE: Joi.number().min(0).max(1).default(1),
  SENTRY_TIMEOUT_MS: Joi.number().min(500).max(30_000).default(5_000),
  METRICS_ENABLED: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),
  METRICS_TOKEN: Joi.string().allow('').optional(),

  // ----- Push notifications (Phase 4) -----
  // Off by default: reminders schedule and fire regardless, they simply do not
  // produce a device notification until this is switched on. An access token is
  // only needed when the Expo project enforces push security.
  PUSH_ENABLED: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
  EXPO_PUSH_URL: Joi.string().uri().allow('').default('https://exp.host/--/api/v2/push/send'),
  EXPO_ACCESS_TOKEN: Joi.string().allow('').optional(),
  PUSH_TIMEOUT_MS: Joi.number().min(1000).max(60_000).default(15_000),
});
