import type { Request } from 'express';

/**
 * The authenticated principal resolved from a verified Supabase access token
 * and attached to the request by {@link SupabaseAuthGuard}. Intentionally
 * minimal — the identity claims the rest of the app can trust.
 */
export interface AuthenticatedUser {
  /** Supabase auth user id (`auth.users.id`); equals `public.users.id`. */
  id: string;
  email: string;
}

/** Express request carrying the authenticated principal. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Normalised session tokens returned to the client after auth. */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry as a Unix timestamp (seconds). */
  expiresAt: number;
  tokenType: string;
}

/** Public view of the authenticated account returned alongside a session. */
export interface AuthUserView {
  id: string;
  email: string;
}
