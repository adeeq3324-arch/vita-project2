import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { SUPABASE_CLIENT } from '../../supabase/supabase.constants';
import type { AuthenticatedUser } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** How long a verified token→identity mapping may be cached, in seconds. */
const VERIFICATION_CACHE_TTL_SECONDS = 30;
const CACHE_PREFIX = 'auth:token:';

/**
 * Global authentication guard. For every non-`@Public()` route it requires a
 * `Authorization: Bearer <token>` header, verifies the token against Supabase
 * Auth, and attaches the resolved {@link AuthenticatedUser} to the request.
 *
 * Verification results are cached in Redis for a short window (keyed by a hash
 * of the token, never the token itself) so a burst of requests on one session
 * doesn't hit the Auth server on every call. The cache TTL is additionally
 * capped by the token's own expiry so a cached entry can never outlive the
 * token it represents.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    const user = await this.verify(token);
    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }

  private extractToken(request: Request): string {
    const header = request.headers.authorization;
    if (!header) {
      throw new UnauthorizedException('Missing Authorization header.');
    }
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Authorization header must be a Bearer token.');
    }
    return token.trim();
  }

  private async verify(token: string): Promise<AuthenticatedUser> {
    const cacheKey = CACHE_PREFIX + createHash('sha256').update(token).digest('hex');

    const cached = await this.readCache(cacheKey);
    if (cached) {
      return cached;
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const user: AuthenticatedUser = {
      id: data.user.id,
      email: data.user.email ?? '',
    };

    await this.writeCache(cacheKey, user, token);
    return user;
  }

  private async readCache(cacheKey: string): Promise<AuthenticatedUser | null> {
    try {
      const raw = await this.redis.get(cacheKey);
      return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
    } catch {
      // A cache miss/parse failure must never block authentication.
      return null;
    }
  }

  private async writeCache(
    cacheKey: string,
    user: AuthenticatedUser,
    token: string,
  ): Promise<void> {
    const ttl = this.cacheTtlSeconds(token);
    if (ttl <= 0) {
      return;
    }
    try {
      await this.redis.set(cacheKey, JSON.stringify(user), 'EX', ttl);
    } catch {
      // Caching is best-effort; verification already succeeded.
    }
  }

  /**
   * Cache TTL bounded by the token's remaining lifetime, so a cached identity
   * never survives longer than the token. Falls back to the default window when
   * the expiry cannot be read (the payload is decoded only to bound the TTL,
   * never to establish identity).
   */
  private cacheTtlSeconds(token: string): number {
    const exp = this.readExpiry(token);
    if (exp === null) {
      return VERIFICATION_CACHE_TTL_SECONDS;
    }
    const remaining = exp - Math.floor(Date.now() / 1000);
    return Math.max(0, Math.min(VERIFICATION_CACHE_TTL_SECONDS, remaining));
  }

  private readExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        exp?: number;
      };
      return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch {
      return null;
    }
  }
}
