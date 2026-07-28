import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorTrackingService } from './error-tracking.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

/**
 * Operational visibility: what broke, and how the system is behaving.
 *
 * Global, because the two consumers are cross-cutting — the exception filter
 * reports every unhandled fault, and the cache service records every hit and
 * miss — and neither should have to be wired module by module.
 *
 * Both channels degrade to no-ops when unconfigured, so development and CI run
 * the same code paths as production with nothing to configure and no
 * credentials to hold.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    ErrorTrackingService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService, ErrorTrackingService],
})
export class ObservabilityModule {}
