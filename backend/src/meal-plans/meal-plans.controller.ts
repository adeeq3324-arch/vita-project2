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
import type { MealPlanItemView, MealPlanStatusView, MealPlanView } from './meal-plan.view';
import type { MealRecipeView } from './meal-recipe.view';
import { MealPlansService } from './meal-plans.service';

/**
 * Weekly AI meal plans, mounted at `/api/v1/meal-plans`. Every route is
 * protected by the global auth guard and scoped to the caller's own plans.
 *
 * The generate/poll/fetch trio is the same contract every generated artefact in
 * the platform exposes, so the client can drive all of them with one hook.
 * `current` is declared ahead of the `:id` routes so it is matched literally
 * rather than being swallowed as an id.
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

  /** This week's plan. Creates nothing — 404 when the week has none yet. */
  @Get('current')
  getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<MealPlanView> {
    return this.mealPlans.getCurrent(user.id);
  }

  /** Poll target while generation is in flight. */
  @Get(':id/status')
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MealPlanStatusView> {
    return this.mealPlans.getStatus(user.id, id);
  }

  /** One meal from the plan, for the detail screen. */
  @Get(':id/items/:itemId')
  getItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<MealPlanItemView> {
    return this.mealPlans.getItem(user.id, id, itemId);
  }

  /**
   * The recipe for one meal — the method, the shopping list, the timings.
   *
   * A POST rather than a GET, and deliberately so. The first call for a dish
   * runs a model generation, and the client retries idempotent verbs on a
   * timeout: as a GET, one slow response would silently become three paid
   * generations. It is nonetheless idempotent in effect — the recipe is written
   * once and every later call returns that same row — so `200 OK` is the honest
   * status rather than `201`.
   */
  @Post(':id/items/:itemId/recipe')
  @HttpCode(HttpStatus.OK)
  @AiRateLimit(40)
  getRecipe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<MealRecipeView> {
    return this.mealPlans.getRecipe(user.id, id, itemId);
  }

  /**
   * Exchanges one meal for a different dish of equivalent nutrition, returning
   * the replacement. Rate-limited more tightly than a whole plan: it is cheap
   * per call but trivially repeatable, and a user tapping "swap" until they like
   * the answer is exactly the pattern that needs a ceiling.
   */
  @Post(':id/items/:itemId/swap')
  @HttpCode(HttpStatus.OK)
  @AiRateLimit(20)
  swapMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<MealPlanItemView> {
    return this.mealPlans.swapMeal(user.id, id, itemId);
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
