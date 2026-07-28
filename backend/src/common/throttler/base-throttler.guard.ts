import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  type ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { InjectThrottlerOptions, InjectThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerException } from '@nestjs/throttler';
import { MetricsService } from '../observability/metrics.service';
import { RATE_LIMIT_KEY_ROOT } from './throttler.constants';

/**
 * Shared behaviour for both rate-limit guards.
 *
 * Two things every limiter in this application needs:
 *
 *  - **A kill switch.** `RATE_LIMIT_ENABLED=false` disables limiting outright.
 *    Tests and local development run without it; production never should.
 *  - **HTTP only.** Queue workers and schedulers execute outside a request, and
 *    a limiter that tried to read an IP from them would throw rather than
 *    limit anything.
 *
 * The 429 body is deliberately shaped like every other error the API emits: it
 * is raised as a normal `HttpException`, so the global RFC 7807 filter renders
 * it in the same problem-details envelope as a 400 or a 404 and clients need no
 * special case for being throttled.
 */
@Injectable()
export abstract class BaseThrottlerGuard extends ThrottlerGuard {
  private readonly enabled: boolean;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    super(options, storage, reflector);
    this.enabled = config.get<boolean>('rateLimit.enabled', true);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return !this.enabled || context.getType() !== 'http';
  }

  /**
   * Raised with `Retry-After` already set by the base guard. The message states
   * when the caller may return rather than only that they were refused — a
   * client backing off correctly needs the number, not the noun.
   */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    this.metrics.recordRateLimited(this.throttlerNameFromKey(detail.key));

    const seconds = Math.max(1, detail.timeToBlockExpire);
    throw new ThrottlerException(
      `Too many requests. Please try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
    );
  }

  /**
   * Recovers which budget refused the request from its storage key.
   *
   * The name is not on `ThrottlerLimitDetail`, but both guards build keys as
   * `<root>:<name>:…`, so it is the segment straight after the root. A metric
   * that only said "something was throttled" would not distinguish a credential
   * attack from a client polling too eagerly.
   */
  private throttlerNameFromKey(key: string): string {
    return key.startsWith(`${RATE_LIMIT_KEY_ROOT}:`)
      ? (key.slice(RATE_LIMIT_KEY_ROOT.length + 1).split(':')[0] ?? 'unknown')
      : 'unknown';
  }
}
