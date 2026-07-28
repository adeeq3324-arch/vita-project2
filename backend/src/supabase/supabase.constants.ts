import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Injection token for the public (anon-key) Supabase client. Used for
 * user-facing auth flows — sign-up, sign-in, token refresh, password reset —
 * and for verifying access tokens against the Auth server.
 */
export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

/**
 * Injection token for the privileged (service-role) Supabase client. Bypasses
 * RLS and exposes the Auth admin API (e.g. global sign-out). Server-only — the
 * service-role key must never leave the backend.
 */
export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');

export type Supabase = SupabaseClient;
