import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route handler (or controller) as unauthenticated. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public, exempting it from the globally-applied
 * {@link SupabaseAuthGuard}. Use on auth entry points (sign-up, login, refresh,
 * password reset) that must be reachable without a token.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
