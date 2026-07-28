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
import type { MealPlanStatusView, MealPlanView } from './meal-plan.view';
import { MealPlansService } from './meal-plans.service';

/**
 * Weekly AI meal plans, mounted at `/api/v1/meal-plans`. Every route is
 * protected by the global auth guard and scoped to the caller's own plans.
 *
 * The generate/poll/fetch trio is the same contract every generated artefact in
 * the platform exposes, so the client can drive all of them with one hook.
 */
@Controller({ path: 'meal-plans', version: '1' })
export class MealPlansController {
  constructor(private readonly mealPlans: MealPlansService) {}

  /**
   * Starts generating this week's plan and returns straight away with an id to
   * poll. Responds `202 Accepted`: the plan is not ready when this returns, and
   * saying so in the status line keeps the contract honest.
   */
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @AiRateLimit(12)
  generate(@CurrentUser() user: AuthenticatedUser): Promise<MealPlanStatusView> {
    return this.mealPlans.generate(user.id);
  }

  /** Poll target while generation is in flight. */
  @Get(':id/status')
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MealPlanStatusView> {
    return this.mealPlans.getStatus(user.id, id);
  }

  /** The plan and its seven days, once ready. */
  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MealPlanView> {
    return this.mealPlans.getById(user.id, id);
  }
}
