import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Req,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { contentType as prometheusContentType } from 'prom-client';
import { Public } from '../../auth/decorators/public.decorator';
import { NoRateLimit } from '../throttler/throttle.decorators';
import { MetricsService } from './metrics.service';

/**
 * Constant-time token comparison.
 *
 * `===` on a secret leaks its prefix through timing, which is enough to recover
 * a token one byte at a time. The length check happens first because
 * `timingSafeEqual` throws on a length mismatch — that comparison is not itself
 * secret, since the length is not what is being guessed.
 */
const tokensMatch = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Prometheus scrape endpoint — `GET /metrics`.
 *
 * Version-neutral and outside the API prefix, because a scraper is not an API
 * client and should not be pinned to a resource version.
 *
 * It is `@Public()` in the sense that it does not take a user's session — a
 * scraper has no account — but it is **not** unauthenticated: it requires a
 * bearer token when `METRICS_TOKEN` is set. Metrics disclose route names,
 * traffic volumes and error rates, which is reconnaissance material, so an
 * internet-reachable deployment must set that variable.
 */
@Public()
@NoRateLimit()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  private readonly enabled: boolean;
  private readonly token?: string;

  constructor(
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('observability.metricsEnabled', true);
    this.token = config.get<string>('observability.metricsToken');
  }

  // The exposition format is negotiated by content type, not by body shape: a
  // scraper that receives `text/html` (Express's default for a string response)
  // discards the payload without parsing it.
  @Get()
  @Header('content-type', prometheusContentType)
  @Header('cache-control', 'no-store')
  async scrape(@Req() request: Request): Promise<string> {
    // Disabled means the endpoint does not exist, not that it exists and
    // refuses: a 404 tells a prober nothing about what is behind it.
    if (!this.enabled) {
      throw new NotFoundException();
    }

    this.authorise(request);
    return this.metrics.render();
  }

  private authorise(request: Request): void {
    if (!this.token) {
      return;
    }

    const header = request.headers.authorization;
    if (!header) {
      throw new UnauthorizedException('Missing Authorization header.');
    }

    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      throw new UnauthorizedException('Authorization header must be a Bearer token.');
    }

    if (!tokensMatch(value.trim(), this.token)) {
      throw new ForbiddenException('Invalid metrics token.');
    }
  }
}
