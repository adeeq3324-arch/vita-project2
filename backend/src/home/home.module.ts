import { Module } from '@nestjs/common';
import { DailyMetricsModule } from '../daily-metrics/daily-metrics.module';
import { GoalsModule } from '../goals/goals.module';
import { MealLogsModule } from '../meal-logs/meal-logs.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

/**
 * Home module — the dashboard aggregator. It owns no tables of its own and
 * composes the other feature services into one response, so the Home tab is a
 * single request rather than half a dozen.
 */
@Module({
  imports: [
    ProfilesModule,
    GoalsModule,
    NutritionTargetsModule,
    MealLogsModule,
    DailyMetricsModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
