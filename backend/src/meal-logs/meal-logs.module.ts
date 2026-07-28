import { Module } from '@nestjs/common';
import { FoodsModule } from '../foods/foods.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { MealLogsController } from './meal-logs.controller';
import { MealLogsService } from './meal-logs.service';

/**
 * Meal logs module — the food diary and every intake roll-up derived from it.
 * Exports {@link MealLogsService} so daily metrics and the home feed can read
 * the same aggregates rather than recomputing intake their own way.
 */
@Module({
  imports: [FoodsModule, ProfilesModule],
  controllers: [MealLogsController],
  providers: [MealLogsService],
  exports: [MealLogsService],
})
export class MealLogsModule {}
