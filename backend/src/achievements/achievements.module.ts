import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkoutLogsModule } from '../workout-logs/workout-logs.module';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';

/**
 * Achievements module — badges, streaks, milestones and the unlock logic behind
 * them.
 *
 * Reads history through {@link AnalyticsModule} rather than the diaries directly,
 * so a streak here and a chart on the Progress tab are computed from the same
 * series. Exports {@link AchievementsService} so the Progress tab can include the
 * badge rail while reusing the window it already built.
 */
@Module({
  imports: [AnalyticsModule, WorkoutLogsModule, NotificationsModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
