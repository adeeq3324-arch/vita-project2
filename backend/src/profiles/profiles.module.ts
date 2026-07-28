import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

/**
 * Profiles module — current-user profile read/update. Exports
 * {@link ProfilesService} so the onboarding flow can reuse profile mapping.
 */
@Module({
  imports: [UsersModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
