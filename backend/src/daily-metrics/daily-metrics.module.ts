import { Module } from '@nestjs/common';
import { MealLogsModule } from '../meal-logs/meal-logs.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { DailyMetricsController } from './daily-metrics.controller';
import { DailyMetricsService } from './daily-metrics.service';

/**
 * Daily metrics module — steps, hydration, body weight, workout status and the
 * composite health score. Depends on meal logs and nutrition targets because the
 * score measures the day's intake against the user's goals.
 *
 * Exports {@link DailyMetricsService} so the home feed can assemble a day (and a
 * week of them) without duplicating the scoring rules.
 */
@Module({
  imports: [ProfilesModule, MealLogsModule, NutritionTargetsModule],
  controllers: [DailyMetricsController],
  providers: [DailyMetricsService],
  exports: [DailyMetricsService],
})
export class DailyMetricsModule {}
