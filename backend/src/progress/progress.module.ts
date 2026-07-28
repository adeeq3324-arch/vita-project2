import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProgressController } from './progress.controller';
import { ProgressProcessor } from './progress.processor';
import { ProgressScheduler } from './progress.scheduler';
import { ProgressService } from './progress.service';

/**
 * Progress analytics module — the Progress tab, and the weekly/monthly snapshot
 * history behind it.
 *
 * Composes the shared analytics window with the achievement standing, so the tab is
 * one response rather than a screen that assembles itself from five endpoints. The
 * scheduler only triggers; the sweep and the request path share one roll-up, so a
 * swept snapshot is produced by exactly the same code as a user-requested one.
 */
@Module({
  imports: [AnalyticsModule, AchievementsModule, ProfilesModule],
  controllers: [ProgressController],
  providers: [ProgressService, ProgressProcessor, ProgressScheduler],
  exports: [ProgressService],
})
export class ProgressModule {}
