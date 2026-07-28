import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HomeFeedQueryDto } from './dto/home-feed.dto';
import type { HomeFeedView } from './home.view';
import { HomeService } from './home.service';

/**
 * Home dashboard endpoint, mounted at `/api/v1/home`. Returns the entire Home
 * tab — metrics, activities, health score and progress — for the authenticated
 * user in a single call.
 */
@Controller({ path: 'home', version: '1' })
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('feed')
  getFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: HomeFeedQueryDto,
  ): Promise<HomeFeedView> {
    return this.home.getFeed(user.id, query);
  }
}
