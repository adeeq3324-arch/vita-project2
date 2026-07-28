import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT, SUPABASE_CLIENT } from './supabase.constants';

/**
 * Stateless client options for a server runtime: never persist or auto-refresh
 * sessions (the backend holds no ambient session — every call is explicit) and
 * do not scan URLs for auth fragments.
 */
const STATELESS_AUTH = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
} as const;

/**
 * Global Supabase module. Provides two long-lived clients:
 *   - {@link SUPABASE_CLIENT}: anon-key client for user auth flows and token
 *     verification.
 *   - {@link SUPABASE_ADMIN_CLIENT}: service-role client for privileged admin
 *     operations (bypasses RLS).
 *
 * Both keys are required from this phase on, so the app fails fast at boot if
 * any Supabase secret is missing rather than erroring on the first auth call.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient => {
        const url = config.getOrThrow<string>('supabase.url');
        const anonKey = config.getOrThrow<string>('supabase.anonKey');
        return createClient(url, anonKey, { auth: STATELESS_AUTH });
      },
    },
    {
      provide: SUPABASE_ADMIN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient => {
        const url = config.getOrThrow<string>('supabase.url');
        const serviceRoleKey = config.getOrThrow<string>('supabase.serviceRoleKey');
        return createClient(url, serviceRoleKey, { auth: STATELESS_AUTH });
      },
    },
  ],
  exports: [SUPABASE_CLIENT, SUPABASE_ADMIN_CLIENT],
})
export class SupabaseModule {}
