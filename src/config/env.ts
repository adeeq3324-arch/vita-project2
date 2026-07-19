import Constants from 'expo-constants';

/**
 * Typed access to runtime configuration.
 *
 * Values come from `EXPO_PUBLIC_*` environment variables, which Expo inlines
 * at build time. Only non-secret, client-safe values belong here — API keys
 * and service credentials stay on the backend.
 */

type EnvKey = keyof NodeJS.ProcessEnv;

function readEnv(key: EnvKey): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function requireEnv(key: EnvKey): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". Add it to your .env file — see .env.example.`,
    );
  }
  return value;
}

export const env = {
  /** Backend (NestJS) base URL. */
  get apiUrl(): string {
    return requireEnv('EXPO_PUBLIC_API_URL');
  },
  /** Supabase project URL. */
  get supabaseUrl(): string {
    return requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  },
  /** Supabase anon key — client-safe; row-level security enforces access. */
  get supabaseAnonKey(): string {
    return requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  },
  /**
   * Whether the AI assistant is on. The model and credentials live server-side
   * and are configured through the environment — the client never names or
   * calls a provider directly. Defaults on so the experience works locally.
   */
  get aiEnabled(): boolean {
    return readEnv('EXPO_PUBLIC_AI_ENABLED') !== 'false';
  },
  /** True in development builds. */
  isDev: __DEV__,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;
