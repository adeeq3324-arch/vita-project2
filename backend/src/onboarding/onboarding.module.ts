import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/**
 * Onboarding module — single-call persistence of profile, goal, and health
 * conditions. Writes across all three tables in one transaction via the global
 * database client.
 */
@Module({
  imports: [UsersModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
