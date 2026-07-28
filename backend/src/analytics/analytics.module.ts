import { Module } from '@nestjs/common';
import { DailyMetricsModule } from '../daily-metrics/daily-metrics.module';
import { GoalsModule } from '../goals/goals.module';
import { MealLogsModule } from '../meal-logs/meal-logs.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { WorkoutLogsModule } from '../workout-logs/workout-logs.module';
import { AnalyticsService } from './analytics.service';

/**
 * The shared read layer under progress analytics and achievements.
 *
 * Deliberately has no controller: it exposes no endpoint of its own and exists so
 * that the two features which *do* — the Progress tab and the achievement
 * evaluator — read one window of history built one way. Keeping it a module in its
 * own right is also what keeps them acyclic: progress depends on achievements, and
 * both depend on this, rather than on each other.
 */
@Module({
  imports: [
    ProfilesModule,
    GoalsModule,
    NutritionTargetsModule,
    MealLogsModule,
    DailyMetricsModule,
    WorkoutLogsModule,
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
