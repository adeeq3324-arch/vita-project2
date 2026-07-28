import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth.types';

/**
 * Injects the authenticated principal (set by {@link SupabaseAuthGuard}) into a
 * controller handler. Only valid on guarded routes; there is always a user.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
