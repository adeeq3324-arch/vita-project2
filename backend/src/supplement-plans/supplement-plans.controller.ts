import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiRateLimit } from '../common/throttler/throttle.decorators';
import type {
  SupplementItemView,
  SupplementPlanStatusView,
  SupplementPlanView,
} from './supplement-plan.view';
import { SupplementPlansService } from './supplement-plans.service';

/**
 * Monthly AI supplement plans, mounted at `/api/v1/supplement-plans`. Every
 * route is protected by the global auth guard and scoped to the caller's own
 * plans.
 *
 * `current` is declared before the `:id` routes so it is matched literally
 * rather than being swallowed as an id.
 */
@Controller({ path: 'supplement-plans', version: '1' })
export class SupplementPlansController {
  constructor(private readonly supplementPlans: SupplementPlansService) {}

  /**
   * Ensures this month has a plan and returns an id to poll.
   *
   * Idempotent by design: called repeatedly within the same month it returns the
   * same plan and generates nothing further.
   */
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @AiRateLimit(12)
  generate(@CurrentUser() user: AuthenticatedUser): Promise<SupplementPlanStatusView> {
    return this.supplementPlans.generate(user.id);
  }

  /** This month's plan. Creates nothing — 404 when the month has none yet. */
  @Get('current')
  getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<SupplementPlanView> {
    return this.supplementPlans.getCurrent(user.id);
  }

  /** Poll target while generation is in flight. */
  @Get(':id/status')
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplementPlanStatusView> {
    return this.supplementPlans.getStatus(user.id, id);
  }

  /** One supplement from the plan, for the detail screen. */
  @Get(':id/items/:itemId')
  getItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<SupplementItemView> {
    return this.supplementPlans.getItem(user.id, id, itemId);
  }

  /** A specific plan and its items. */
  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplementPlanView> {
    return this.supplementPlans.getById(user.id, id);
  }
}
