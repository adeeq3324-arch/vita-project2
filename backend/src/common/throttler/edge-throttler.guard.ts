import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { BaseThrottlerGuard } from './base-throttler.guard';
import { RATE_LIMIT_KEY_ROOT, THROTTLER_GLOBAL } from './throttler.constants';

/**
 * The outer shield: a coarse per-IP limit applied **before** authentication.
 *
 * It exists for the one case the per-user limiter structurally cannot cover.
 * The user-keyed guard runs after the auth guard, so a request bearing an
 * invalid token is rejected as a 401 before any limit is consulted — meaning a
 * flood of junk tokens would otherwise reach Supabase's auth API unmetered, at
 * full rate, forever. This guard meters that traffic while it is still
 * anonymous.
 *
 * The limit is deliberately generous. Mobile clients sit behind carrier NAT,
 * where thousands of unrelated users share one address, so anything tuned for
 * fairness would throttle innocent people; fairness is the *other* guard's job.
 * This one only has to make a flood cost something.
 */
@Injectable()
export class EdgeThrottlerGuard extends BaseThrottlerGuard {
  /**
   * Enforces only the `global` throttler.
   *
   * All three are registered in one place so both guards share a single store,
   * but this one must not evaluate the per-caller limits: it runs before
   * authentication, where there is no identity to key them by, and doing so
   * would spend those budgets against an IP and then charge the user again.
   */
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((throttler) => throttler.name === THROTTLER_GLOBAL);
  }

  /**
   * The client address, as resolved by Express. `trust proxy` is configured at
   * bootstrap so this is the real client behind a load balancer rather than the
   * balancer itself — without that every request would share one bucket.
   */
  protected async getTracker(req: Request): Promise<string> {
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  /**
   * One bucket for the entire API, not one per route.
   *
   * The library's default key includes the controller and handler names, which
   * would let a flood evade the limit simply by spreading itself across
   * endpoints. Omitting them is the whole point of this guard.
   */
  protected generateKey(_context: unknown, tracker: string, name: string): string {
    return `${RATE_LIMIT_KEY_ROOT}:${name}:${tracker}`;
  }
}
