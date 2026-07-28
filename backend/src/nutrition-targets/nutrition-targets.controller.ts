import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SetNutritionTargetsDto } from './dto/set-nutrition-targets.dto';
import type { NutritionTargetView } from './nutrition-target.view';
import { NutritionTargetsService } from './nutrition-targets.service';

/**
 * Daily nutrition target endpoints, mounted at `/api/v1/nutrition/targets`.
 * All routes operate on the authenticated user's own targets.
 */
@Controller({ path: 'nutrition/targets', version: '1' })
export class NutritionTargetsController {
  constructor(private readonly targets: NutritionTargetsService) {}

  /** Current targets, derived from the profile and goal on first request. */
  @Get()
  getMyTargets(@CurrentUser() user: AuthenticatedUser): Promise<NutritionTargetView> {
    return this.targets.get(user.id);
  }

  /** Overrides one or more targets, switching them to `custom`. */
  @Put()
  setMyTargets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetNutritionTargetsDto,
  ): Promise<NutritionTargetView> {
    return this.targets.setCustom(user.id, dto);
  }

  /** Discards any override and re-derives from the current profile and goal. */
  @Post('recalculate')
  @HttpCode(HttpStatus.OK)
  recalculate(@CurrentUser() user: AuthenticatedUser): Promise<NutritionTargetView> {
    return this.targets.recalculate(user.id);
  }
}
