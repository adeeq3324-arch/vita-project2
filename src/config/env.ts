import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Typed access to runtime configuration.
 *
 * Values come from `EXPO_PUBLIC_*` environment variables, which Expo inlines
 * at build time. Only non-secret, client-safe values belong here — API keys
 * and service credentials stay on the backend.
 *
 * IMPORTANT: Expo/Metro only substitutes `EXPO_PUBLIC_*` vars that are
 * referenced *statically* (e.g. `process.env.EXPO_PUBLIC_API_URL`). Dynamic
 * access such as `process.env[key]` is NOT replaced and resolves to
 * `undefined` in the bundle — hence every var below is read by its literal name.
 */

// Read each var by its literal name so the bundler can inline it.
const RAW_ENV = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  aiEnabled: process.env.EXPO_PUBLIC_AI_ENABLED,
} as const;

function clean(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function required(name: string, value: string | undefined): string {
  const resolved = clean(value);
  if (!resolved) {
    throw new Error(
      `Missing required environment variable "${name}". Add it to your .env file — see .env.example.`,
    );
  }
  return resolved;
}

/**
 * The IP/host that the Metro dev server is served from (e.g. "192.168.1.5:8081"
 * → "192.168.1.5"). On a physical device this is the developer's machine, which
 * is what a locally-running backend is reachable at. Returns null when it can't
 * be determined (e.g. production builds).
 */
function metroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Fallbacks across Expo SDK versions / Expo Go.
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | undefined)?.extra
      ?.expoGo?.debuggerHost;
  const host = hostUri?.split(':')[0]?.trim();
  return host && host.length > 0 ? host : null;
}

/**
 * Resolves the backend base URL. Uses `EXPO_PUBLIC_API_URL` as configured, but
 * on a native device where it points at localhost — which on a phone means the
 * phone itself, not the dev machine — rewrites the host to the Metro server's
 * IP so the local backend is reachable with no per-machine `.env` edits. Web
 * and production (absolute non-localhost URLs) are used verbatim.
 */
function resolveApiUrl(): string {
  const configured = required('EXPO_PUBLIC_API_URL', RAW_ENV.apiUrl);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(configured);
  if (Platform.OS !== 'web' && isLocalhost) {
    const host = metroHost();
    if (host) {
      return configured.replace(/(https?:\/\/)(localhost|127\.0\.0\.1)/i, `$1${host}`);
    }
  }
  return configured;
}

export const env = {
  /** Backend (NestJS) base URL. */
  get apiUrl(): string {
    return resolveApiUrl();
  },
  /** Supabase project URL. */
  get supabaseUrl(): string {
    return required('EXPO_PUBLIC_SUPABASE_URL', RAW_ENV.supabaseUrl);
  },
  /** Supabase anon key — client-safe; row-level security enforces access. */
  get supabaseAnonKey(): string {
    return required('EXPO_PUBLIC_SUPABASE_ANON_KEY', RAW_ENV.supabaseAnonKey);
  },
  /**
   * Whether the AI assistant is on. The model and credentials live server-side
   * and are configured through the environment — the client never names or
   * calls a provider directly. Defaults on so the experience works locally.
   */
  get aiEnabled(): boolean {
    return clean(RAW_ENV.aiEnabled) !== 'false';
  },
  /** True in development builds. */
  isDev: __DEV__,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;
