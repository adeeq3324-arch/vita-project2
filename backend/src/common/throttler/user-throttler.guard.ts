import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { BaseThrottlerGuard } from './base-throttler.guard';
import { RATE_LIMIT_KEY_ROOT, THROTTLER_AI, THROTTLER_GLOBAL } from './throttler.constants';

/** A request once the auth guard has resolved (or not resolved) an identity. */
type MaybeAuthenticated = Request & { user?: AuthenticatedUser };

/**
 * The inner limiter: per-caller budgets applied **after** authentication.
 *
 * Keyed by user id wherever one is known, which is what makes the limits fair.
 * Keying on IP alone would punish everyone behind a shared carrier NAT for one
 * heavy user, and would give a single user an unlimited budget the moment they
 * changed networks. Public routes have no identity to key on and fall back to
 * the address.
 */
@Injectable()
export class UserThrottlerGuard extends BaseThrottlerGuard {
  /**
   * Enforces the per-caller limits and leaves the `global` shield to the edge
   * guard, which has already applied it earlier in the chain. Evaluating it
   * again here would count every request twice and halve the effective limit.
   */
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((throttler) => throttler.name !== THROTTLER_GLOBAL);
  }

  /**
   * The caller's identity, or their address when they have none.
   *
   * The two are prefixed so they can never collide: without it, a user whose id
   * happened to look like an address would share that address's budget.
   */
  protected async getTracker(req: MaybeAuthenticated): Promise<string> {
    const userId = req.user?.id;
    return userId ? `u:${userId}` : `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
  }

  /**
   * Route-scoped for ordinary limits, deliberately not for the model budget.
   *
   * Ordinary endpoints each get their own bucket, so a burst of diary writes
   * cannot exhaust the allowance for reading the home feed, and a `@Throttle`
   * override on one route means what it says locally.
   *
   * The `ai` budget is the exception: every model call costs money wherever it
   * is made, so scans, coach turns and plan generations share one bucket. Were
   * it route-scoped, a caller could spend the same allowance three times over
   * by rotating between endpoints.
   */
  protected generateKey(context: ExecutionContext, tracker: string, name: string): string {
    if (name === THROTTLER_AI) {
      return `${RATE_LIMIT_KEY_ROOT}:${name}:${tracker}`;
    }

    const route = `${context.getClass().name}.${context.getHandler().name}`;
    return `${RATE_LIMIT_KEY_ROOT}:${name}:${route}:${tracker}`;
  }
}
