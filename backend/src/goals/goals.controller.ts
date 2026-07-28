import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateGoalDto } from './dto/update-goal.dto';
import type { GoalView } from './goal.view';
import { GoalsService } from './goals.service';

/**
 * Current-user goal endpoints, mounted at `/api/v1/goals`. Both routes are
 * protected by the global auth guard and operate exclusively on the
 * authenticated user's own goal.
 */
@Controller({ path: 'goals', version: '1' })
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('me')
  getMyGoal(@CurrentUser() user: AuthenticatedUser): Promise<GoalView> {
    return this.goals.getByUserId(user.id);
  }

  @Patch('me')
  updateMyGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalView> {
    return this.goals.update(user.id, dto);
  }
}
