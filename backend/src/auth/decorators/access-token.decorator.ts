import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extracts the raw Bearer access token from the request. Used by logout, which
 * needs the token itself (to revoke it) rather than the decoded principal.
 */
export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('A Bearer access token is required.');
    }
    return token.trim();
  },
);
