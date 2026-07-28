import { Module } from '@nestjs/common';
import { AiContextModule } from '../ai-context/ai-context.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SupplementPlansController } from './supplement-plans.controller';
import { SupplementPlansProcessor } from './supplement-plans.processor';
import { SupplementPlansScheduler } from './supplement-plans.scheduler';
import { SupplementPlansService } from './supplement-plans.service';

/**
 * Supplement plans module — AI-generated monthly regimens, on demand and on a
 * schedule. The scheduler only triggers; the worker and the request path share
 * one service, so a swept plan is produced by exactly the same code as a
 * user-requested one.
 */
@Module({
  imports: [AiContextModule, ProfilesModule],
  controllers: [SupplementPlansController],
  providers: [SupplementPlansService, SupplementPlansProcessor, SupplementPlansScheduler],
  exports: [SupplementPlansService],
})
export class SupplementPlansModule {}
