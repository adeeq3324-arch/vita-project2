import { Module } from '@nestjs/common';
import { DailyMetricsModule } from '../daily-metrics/daily-metrics.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { WorkoutLogsController } from './workout-logs.controller';
import { WorkoutLogsService } from './workout-logs.service';

/**
 * Workout logs module — the training diary and every fitness roll-up derived
 * from it.
 *
 * Depends on daily metrics so a logged session immediately moves the day's
 * `workout_completed` / `workout_minutes`, and with them the home dashboard and
 * the health score. Exports {@link WorkoutLogsService} so progress analytics and
 * the achievement evaluator read the same aggregates rather than each writing
 * their own idea of what a training week looks like.
 */
@Module({
  imports: [ProfilesModule, DailyMetricsModule],
  controllers: [WorkoutLogsController],
  providers: [WorkoutLogsService],
  exports: [WorkoutLogsService],
})
export class WorkoutLogsModule {}
