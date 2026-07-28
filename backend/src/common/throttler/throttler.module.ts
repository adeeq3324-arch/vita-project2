import { ExecutionContext, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerModule, type ThrottlerOptions } from '@nestjs/throttler';
import { EdgeThrottlerGuard } from './edge-throttler.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import {
  AI_ROUTE_KEY,
  THROTTLER_AI,
  THROTTLER_DEFAULT,
  THROTTLER_GLOBAL,
} from './throttler.constants';
import { UserThrottlerGuard } from './user-throttler.guard';

/**
 * Reads the `ai` marker off the handler.
 *
 * A single stateless instance: `Reflector` only reads metadata, so building one
 * per request would allocate for nothing.
 */
const reflector = new Reflector();

/**
 * Whether the shared model budget applies to this request.
 *
 * The guard evaluates every configured throttler on every request, and each one
 * costs a Redis round-trip. Skipping `ai` unless the handler opted in keeps
 * ordinary endpoints at a single round-trip instead of two.
 */
const isModelBackedRoute = (context: ExecutionContext): boolean =>
  reflector.getAllAndOverride<boolean>(AI_ROUTE_KEY, [
    context.getHandler(),
    context.getClass(),
  ]) === true;

/**
 * Publishes the Redis-backed store so the throttler's own async factory can
 * inject it.
 *
 * Custom storage has to be handed to `ThrottlerModule` through the `storage`
 * field of its options — that is the only route the guards read it by.
 * Registering an implementation against the exported `ThrottlerStorage` symbol
 * instead does *not* work: `@InjectThrottlerStorage()` resolves a private token
 * of the library's own, so the binding is simply ignored and every guard
 * silently falls back to the in-process default. That failure is invisible in a
 * single-instance test and severe in production, where it multiplies every limit
 * by the number of running containers — which is exactly how it was caught here,
 * by an end-to-end test that mocks Redis out and expects the limiter to notice.
 */
@Global()
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}

/**
 * Rate-limiting foundation.
 *
 * Registers all three throttlers once — the module is global, so both guards
 * share one options object and one Redis-backed store — and installs the
 * **edge** guard. That guard has to run before authentication, so this module
 * is imported ahead of `AuthModule`; {@link UserThrottlerModule} installs the
 * per-caller guard behind it.
 *
 * Each guard enforces only the throttlers it owns (see their `onModuleInit`),
 * so registering them together here does not mean both apply everywhere.
 *
 * @see ThrottlerStorageModule for why the store is passed through options.
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => {
        const seconds = (value: number): number => value * 1000;

        const global: ThrottlerOptions = {
          name: THROTTLER_GLOBAL,
          limit: config.get<number>('rateLimit.global.limit', 600),
          ttl: seconds(config.get<number>('rateLimit.global.ttlSeconds', 60)),
          blockDuration: seconds(config.get<number>('rateLimit.global.blockSeconds', 60)),
        };

        const perCaller: ThrottlerOptions = {
          name: THROTTLER_DEFAULT,
          limit: config.get<number>('rateLimit.default.limit', 120),
          ttl: seconds(config.get<number>('rateLimit.default.ttlSeconds', 60)),
          blockDuration: seconds(config.get<number>('rateLimit.default.blockSeconds', 60)),
        };

        const model: ThrottlerOptions = {
          name: THROTTLER_AI,
          limit: config.get<number>('rateLimit.ai.limit', 60),
          ttl: seconds(config.get<number>('rateLimit.ai.ttlSeconds', 3600)),
          blockDuration: seconds(config.get<number>('rateLimit.ai.blockSeconds', 300)),
          skipIf: (context) => !isModelBackedRoute(context),
        };

        // Counting in Redis rather than in-process is what makes a limit mean
        // the same thing however many instances are running.
        return { throttlers: [global, perCaller, model], storage };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: EdgeThrottlerGuard }],
})
export class ThrottlerCoreModule {}

/**
 * Installs the per-caller guard.
 *
 * Split from {@link ThrottlerCoreModule} purely to control ordering: global
 * guards run in the order their modules are initialised, and this one must come
 * after `AuthModule` so `request.user` is populated and limits can be keyed by
 * identity rather than by address.
 */
@Module({
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class UserThrottlerModule {}
