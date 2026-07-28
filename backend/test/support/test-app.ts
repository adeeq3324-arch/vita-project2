import {
  Body,
  Controller,
  Get,
  Global,
  INestApplication,
  Module,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { AuthRateLimit, NoRateLimit, AiRateLimit } from '../../src/common/throttler/throttle.decorators';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ErrorTrackingService } from '../../src/common/observability/error-tracking.service';
import { MetricsInterceptor } from '../../src/common/observability/metrics.interceptor';
import { MetricsService } from '../../src/common/observability/metrics.service';
import {
  ThrottlerCoreModule,
  UserThrottlerModule,
} from '../../src/common/throttler/throttler.module';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';
import { SearchFoodsDto } from '../../src/foods/dto/search-foods.dto';
import { SignUpDto } from '../../src/auth/dto/sign-up.dto';
import { FakeRedis } from './fake-redis';

/**
 * Probe routes standing in for the real controllers.
 *
 * The point of this suite is the cross-cutting stack — guards, pipes, filter —
 * not any one feature, and driving it through real feature controllers would
 * drag their databases and model clients in with them. The DTOs are the genuine
 * ones, so what is validated here is exactly what production validates.
 */
@Controller('probe')
export class ProbeController {
  /** Ordinary authenticated-shaped route on the default allowance. */
  @Get('ordinary')
  ordinary(): { ok: true } {
    return { ok: true };
  }

  /** A second route, used to prove the default budget is per-route. */
  @Get('other')
  other(): { ok: true } {
    return { ok: true };
  }

  /** Carries the strict credential limit. */
  @Post('credentials')
  @AuthRateLimit()
  credentials(@Body() dto: SignUpDto): { email: string } {
    return { email: dto.email };
  }

  /** Opts into the shared model budget. */
  @Get('model-a')
  @AiRateLimit(3)
  modelA(): { ok: true } {
    return { ok: true };
  }

  /** A second model-backed route, to prove the budget is shared, not per-route. */
  @Get('model-b')
  @AiRateLimit(3)
  modelB(): { ok: true } {
    return { ok: true };
  }

  /** Validates a real query DTO. */
  @Get('search')
  search(@Query() dto: SearchFoodsDto): SearchFoodsDto {
    return dto;
  }

  /** Exempt from every limiter, like the health and metrics probes. */
  @Get('infrastructure')
  @NoRateLimit()
  infrastructure(): { ok: true } {
    return { ok: true };
  }

  /** Raises an unexpected fault, to exercise the 500 path and error reporting. */
  @Get('boom')
  boom(): never {
    throw new Error('internal detail that must not leak');
  }
}

export interface TestAppOptions {
  /** Overrides for the rate-limit configuration. */
  rateLimit?: Record<string, unknown>;
}

export interface TestApp {
  app: INestApplication;
  redis: FakeRedis;
  errorTracking: { capture: jest.Mock };
  metrics: MetricsService;
}

/**
 * Boots an application carrying the real Phase 5 middleware stack.
 *
 * Everything under test is the production article: both throttler guards in
 * their production order, the real Redis-backed storage, the global validation
 * pipe configured exactly as `main.ts` configures it, and the RFC 7807
 * exception filter. Only the two external dependencies are doubled — Redis,
 * because a test should not need a server, and the error reporter, because a
 * test should not post to a monitoring vendor.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const redis = new FakeRedis();
  const errorTracking = { capture: jest.fn().mockResolvedValue(undefined), enabled: true };

  const configuration = (): Record<string, unknown> => ({
    env: 'test',
    rateLimit: {
      enabled: true,
      // Trusted by default here so a test can present distinct client addresses
      // via `X-Forwarded-For`, as it would behind a load balancer. The opposite
      // setting is exercised explicitly, since honouring that header when the
      // service is directly exposed is how the shield gets evaded.
      trustProxy: true,
      global: { limit: 600, ttlSeconds: 60, blockSeconds: 60 },
      default: { limit: 5, ttlSeconds: 60, blockSeconds: 60 },
      ai: { limit: 3, ttlSeconds: 3600, blockSeconds: 300 },
      ...options.rateLimit,
    },
    observability: { metricsEnabled: true, environment: 'test', sampleRate: 1, timeoutMs: 1000 },
  });

  /**
   * The doubles, provided globally.
   *
   * In production the Redis client and the observability services come from
   * `@Global()` modules, so any module can inject them without importing
   * anything. The throttler guards rely on exactly that. Registering them as
   * plain root providers here would leave `ThrottlerCoreModule` unable to
   * resolve them, so the test wiring mirrors the production wiring.
   */
  @Global()
  @Module({
    providers: [
      MetricsService,
      { provide: REDIS_CLIENT, useValue: redis },
      { provide: ErrorTrackingService, useValue: errorTracking },
      // The filter logs through pino; a no-op logger keeps the suite quiet
      // without changing which branch it takes.
      {
        provide: PinoLogger,
        useValue: { setContext: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
      },
    ],
    exports: [MetricsService, REDIS_CLIENT, ErrorTrackingService, PinoLogger],
  })
  class TestGlobalsModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [configuration], ignoreEnvFile: true }),
      TestGlobalsModule,
      // Imported in the same order as `AppModule`, because that order is what
      // decides which guard runs first — and the security property being tested
      // depends entirely on the edge guard running before authentication.
      ThrottlerCoreModule,
      UserThrottlerModule,
    ],
    controllers: [ProbeController],
    providers: [
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
      // Registered here for the same reason `ObservabilityModule` registers it
      // in production: without it no HTTP metric is ever recorded.
      { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  const config = app.get(ConfigService);

  app.set('trust proxy', config.get('rateLimit.trustProxy'));

  // Identical to the bootstrap configuration, so a payload rejected here is
  // rejected in production for the same reason.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  return { app, redis, errorTracking, metrics: app.get(MetricsService) };
}
