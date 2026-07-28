import { Module } from '@nestjs/common';
import { HealthConditionsController } from './health-conditions.controller';
import { HealthConditionsService } from './health-conditions.service';

/**
 * Health-conditions module — current-user declared-conditions read/replace.
 * The initial set is written during onboarding; this module edits it afterwards
 * from the Health Conditions screen.
 */
@Module({
  controllers: [HealthConditionsController],
  providers: [HealthConditionsService],
  exports: [HealthConditionsService],
})
export class HealthConditionsModule {}
