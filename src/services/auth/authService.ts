import { api } from '@/services/api/client';

import { clearSession, getAccessToken, setSession, type Session } from './session';

/**
 * Auth service — email/password flows against the VITAL AI backend
 * (`/api/v1/auth/*`). Persists the returned session so subsequent requests are
 * automatically authenticated.
 */

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthResponse {
  user: AuthUser;
  session: Session | null;
  emailConfirmationRequired: boolean;
}

export interface AuthResult {
  user: AuthUser;
  /** True when the account was created but the email must be confirmed first. */
  emailConfirmationRequired: boolean;
}

/**
 * Creates an account. On success with a session (email confirmation disabled),
 * the session is stored and the user is immediately authenticated. When
 * confirmation is required, no session is stored and the caller should prompt
 * the user to verify their email.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const res = await api.post<AuthResponse>(
    '/api/v1/auth/signup',
    { email, password },
    { skipAuth: true },
  );
  if (res.session) {
    await setSession(res.session);
  }
  return { user: res.user, emailConfirmationRequired: res.emailConfirmationRequired };
}

/** Logs in and stores the session. */
export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await api.post<AuthResponse>(
    '/api/v1/auth/login',
    { email, password },
    { skipAuth: true },
  );
  if (res.session) {
    await setSession(res.session);
  }
  return { user: res.user, emailConfirmationRequired: res.emailConfirmationRequired };
}

/** Revokes the session on the backend and clears it locally. */
export async function logout(): Promise<void> {
  try {
    const token = await getAccessToken();
    if (token) {
      await api.post('/api/v1/auth/logout');
    }
  } catch {
    // Even if revocation fails, clear locally so the user is signed out here.
  } finally {
    await clearSession();
  }
}

/** Requests a password-reset email. Always resolves (no account enumeration). */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/api/v1/auth/password/reset', { email }, { skipAuth: true });
}
