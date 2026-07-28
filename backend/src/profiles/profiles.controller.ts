import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { ProfileView } from './profile.view';
import { ProfilesService } from './profiles.service';

/**
 * Current-user profile endpoints, mounted at `/api/v1/profiles`. Both routes
 * are protected by the global auth guard and operate exclusively on the
 * authenticated user's own profile.
 */
@Controller({ path: 'profiles', version: '1' })
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileView> {
    return this.profiles.getByUserId(user.id);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileView> {
    return this.profiles.update(user.id, dto);
  }
}
