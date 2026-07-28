import { Controller, Get, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AchievementsView } from './achievement.view';
import { AchievementsService } from './achievements.service';

/**
 * Achievement endpoints, mounted at `/api/v1/achievements`.
 *
 * There is no route for granting one. Achievements are earned by what the user
 * actually did, evaluated server-side from their own history — a client that could
 * award itself a badge would make every badge meaningless.
 */
@Controller({ path: 'achievements', version: '1' })
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /**
   * The badge rail and milestone list. Evaluated behind a short cache, so the
   * standing is always current without re-aggregating a quarter of history on
   * every open of the Progress tab.
   */
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<AchievementsView> {
    return this.achievements.get(user.id);
  }

  /**
   * Forces a fresh evaluation, bypassing the cache, and returns anything newly
   * earned in `newlyUnlocked`.
   *
   * Idempotent: it awards nothing that the user's own history does not already
   * justify, so calling it repeatedly is safe. Intended for the pull-to-refresh
   * gesture and for right after a workout is logged, when the user is most likely
   * to have just crossed a line.
   */
  @Post('evaluate')
  evaluate(@CurrentUser() user: AuthenticatedUser): Promise<AchievementsView> {
    return this.achievements.evaluate(user.id);
  }
}
