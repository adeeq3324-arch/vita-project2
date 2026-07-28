import { applyDecorators, SetMetadata } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  AI_ROUTE_KEY,
  THROTTLER_AI,
  THROTTLER_DEFAULT,
  THROTTLER_GLOBAL,
} from './throttler.constants';

const seconds = (value: number): number => value * 1000;
const minutes = (value: number): number => seconds(value * 60);

/**
 * Route-level rate limits.
 *
 * The module-wide default is a generous per-route, per-user allowance sized for
 * ordinary reads and writes. These decorators tighten it where an endpoint is
 * either expensive to serve or attractive to abuse — the two cases where the
 * default is the wrong number.
 */

/**
 * Credential endpoints: sign-up, sign-in, password reset.
 *
 * Tuned against credential stuffing rather than typing mistakes. Ten attempts
 * per quarter-hour is far beyond what a person fumbling their own password
 * needs and far below what guessing someone else's requires. These routes are
 * public, so the bucket is the caller's address.
 *
 * Token refresh is deliberately excluded: a long-lived session refreshes on a
 * schedule the user never sees, and folding it in here would sign people out
 * for using the app normally.
 */
export const AuthRateLimit = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [THROTTLER_DEFAULT]: { limit: 10, ttl: minutes(15), blockDuration: minutes(15) },
  });

/**
 * Endpoints that call the generative model: the three scanners, coach turns,
 * meal and supplement plan generation.
 *
 * `cost` is how many units of the shared allowance one call spends, expressed
 * as a divisor of the budget — an image scan is charged more heavily than a
 * chat turn because it is more expensive to serve.
 *
 * Marking the handler is what switches the shared `ai` bucket on: it is skipped
 * everywhere else, so ordinary endpoints never pay for a second Redis
 * round-trip they do not need.
 */
export const AiRateLimit = (perHour: number): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(AI_ROUTE_KEY, true),
    Throttle({
      [THROTTLER_AI]: { limit: perHour, ttl: minutes(60), blockDuration: minutes(5) },
    }),
  );

/**
 * Search and catalogue browsing: cheap per call, but polled hard by a search
 * box that fires on every keystroke, so the ceiling is high and the window
 * short.
 */
export const SearchRateLimit = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [THROTTLER_DEFAULT]: { limit: 120, ttl: minutes(1), blockDuration: seconds(30) },
  });

/**
 * Exempts a route from every limiter.
 *
 * Reserved for infrastructure endpoints — the health probe an orchestrator
 * calls on a fixed interval, and the metrics endpoint a scraper polls. Throttling
 * either one would make a monitoring system look like an outage.
 */
export const NoRateLimit = (): MethodDecorator & ClassDecorator =>
  SkipThrottle({
    [THROTTLER_GLOBAL]: true,
    [THROTTLER_DEFAULT]: true,
    [THROTTLER_AI]: true,
  });
