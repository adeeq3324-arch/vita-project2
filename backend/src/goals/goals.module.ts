import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

/**
 * Goals module — current-user goal read/update. The goal row is created during
 * onboarding; this module edits it afterwards from the Change Goal screen.
 */
@Module({
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
