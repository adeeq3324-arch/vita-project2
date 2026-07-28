import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/services/api/client';

/**
 * Session store — the single source of truth for the current auth session.
 *
 * Keeps the tokens in memory for fast synchronous-ish access and mirrors them
 * to persistent storage (AsyncStorage: localStorage on web, native storage on
 * device) so the user stays signed in across app launches. The API client pulls
 * the access token from here via {@link getAccessToken}.
 */

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry as a Unix timestamp (seconds). */
  expiresAt: number;
  tokenType: string;
}

const STORAGE_KEY = 'vital.auth.session';
/** Refresh a little before expiry so in-flight requests never carry a dead token. */
const REFRESH_SKEW_SECONDS = 60;

let current: Session | null = null;
let loaded = false;
/** De-dupes concurrent refreshes so a burst of requests triggers a single call. */
let refreshInFlight: Promise<Session | null> | null = null;

/** Loads any persisted session into memory. Call once at app start. */
export async function loadSession(): Promise<Session | null> {
  if (loaded) return current;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    current = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    current = null;
  }
  loaded = true;
  return current;
}

export async function setSession(session: Session): Promise<void> {
  current = session;
  loaded = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Non-fatal: the in-memory session still works for this app run.
  }
}

export async function clearSession(): Promise<void> {
  current = null;
  loaded = true;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — the in-memory session is already cleared.
  }
}

export function getSession(): Session | null {
  return current;
}

export function isAuthenticated(): boolean {
  return current !== null;
}

/**
 * Returns a valid access token, transparently refreshing it when it is expired
 * or about to expire. Returns null when there is no session or the refresh
 * fails (the caller then behaves as unauthenticated).
 */
export async function getAccessToken(): Promise<string | null> {
  if (!loaded) await loadSession();
  if (!current) return null;

  const now = Math.floor(Date.now() / 1000);
  if (current.expiresAt - REFRESH_SKEW_SECONDS > now) {
    return current.accessToken;
  }

  const refreshed = await refreshSession();
  return refreshed?.accessToken ?? null;
}

/** Exchanges the refresh token for a new session; clears state on failure. */
async function refreshSession(): Promise<Session | null> {
  if (!current) return null;
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = current.refreshToken;
  refreshInFlight = (async () => {
    try {
      const res = await api.post<{ session: Session | null }>(
        '/api/v1/auth/refresh',
        { refreshToken },
        { skipAuth: true },
      );
      if (res.session) {
        await setSession(res.session);
        return res.session;
      }
      await clearSession();
      return null;
    } catch {
      await clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
