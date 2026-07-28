import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { SUPABASE_ADMIN_CLIENT, SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { UsersService } from '../users/users.service';
import type { AuthUserView, SessionTokens } from './auth.types';

/** Result of an auth flow that yields (or may yield) a session. */
export interface AuthResult {
  user: AuthUserView;
  /** Null when the account exists but email confirmation is still pending. */
  session: SessionTokens | null;
  /** True when sign-up succeeded but the user must confirm their email first. */
  emailConfirmationRequired: boolean;
}

/**
 * Auth orchestration over Supabase Auth (email/password only in Phase 1).
 * Wraps sign-up, login, refresh, logout and password reset, maps provider
 * errors to precise HTTP failures, and keeps the local `users` table in sync
 * with the authoritative Auth records.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly admin: SupabaseClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async signUp(email: string, password: string): Promise<AuthResult> {
    // Create the account already email-confirmed via the admin API. This keeps
    // sign-up a single, frictionless step — no verification email to click —
    // and is controlled entirely server-side, independent of the project's
    // "Confirm email" setting. (Password reset still verifies by email.)
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (this.isUserExistsError(error)) {
        // The address is already registered. If the supplied password is
        // correct, treat sign-up as an idempotent sign-in — this transparently
        // recovers a previous sign-up whose local mirroring failed *after* the
        // Auth user was created (leaving an Auth account the user could never
        // reach). Only when the password does not match is the email genuinely
        // taken by someone else.
        try {
          return await this.signIn(email, password);
        } catch {
          throw new ConflictException('An account with this email already exists.');
        }
      }
      throw this.mapAuthError(error, 'Sign-up failed.');
    }
    if (!data.user) {
      throw new BadGatewayException('Sign-up failed.');
    }

    // Mirror the auth identity locally so downstream foreign keys resolve.
    await this.users.ensureUser(data.user.id, data.user.email ?? email);

    // Immediately establish a session so the user is signed in on completion.
    return this.signIn(email, password);
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw this.mapAuthError(error, 'Invalid email or password.');
    }

    await this.users.ensureUser(data.user.id, data.user.email ?? email);

    return {
      user: this.toUserView(data.user),
      session: this.toSessionTokens(data.session),
      emailConfirmationRequired: false,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return {
      user: this.toUserView(data.user),
      session: this.toSessionTokens(data.session),
      emailConfirmationRequired: false,
    };
  }

  /**
   * Revokes the session behind the given access token everywhere and evicts the
   * guard's verification cache so the token stops being honoured immediately.
   */
  async logout(accessToken: string): Promise<void> {
    const { error } = await this.admin.auth.admin.signOut(accessToken, 'global');
    // A token that's already invalid/expired is a successful logout, not an error.
    if (error && !this.isExpectedLogoutError(error)) {
      this.logger.warn(`Logout revocation returned an error: ${error.message}`);
    }
    await this.evictTokenCache(accessToken);
  }

  /**
   * Sends a password-reset email. Always resolves without revealing whether the
   * address is registered, to prevent account enumeration.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo = this.config.get<string>('supabase.passwordResetRedirectUrl');
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) {
      // Log for operators but never surface to the caller (enumeration guard).
      this.logger.warn(`Password reset request failed for an address: ${error.message}`);
    }
  }

  private toSessionTokens(session: Session): SessionTokens {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? 0,
      tokenType: session.token_type,
    };
  }

  private toUserView(user: User): AuthUserView {
    return { id: user.id, email: user.email ?? '' };
  }

  private async evictTokenCache(accessToken: string): Promise<void> {
    const key = 'auth:token:' + createHash('sha256').update(accessToken).digest('hex');
    try {
      await this.redis.del(key);
    } catch {
      // Best-effort; the cache entry expires on its own shortly regardless.
    }
  }

  private isUserExistsError(error: AuthError): boolean {
    return (
      error.code === 'user_already_exists' ||
      error.code === 'email_exists' ||
      /already.*(registered|exists)/i.test(error.message)
    );
  }

  private isExpectedLogoutError(error: AuthError): boolean {
    return error.status === 401 || error.status === 403 || error.status === 404;
  }

  /**
   * Maps a Supabase auth error to an HTTP exception. 4xx from the provider is a
   * client problem (surfaced with `fallbackMessage`); anything else is an
   * upstream failure reported as 502 without leaking provider internals.
   */
  private mapAuthError(error: AuthError, fallbackMessage: string): Error {
    const status = error.status ?? 0;
    if (status === 400 || status === 401 || status === 403 || status === 422) {
      return new UnauthorizedException(fallbackMessage);
    }
    this.logger.error(`Unexpected Supabase auth error (${status}): ${error.message}`);
    return new BadGatewayException('The authentication service is currently unavailable.');
  }
}
