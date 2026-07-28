import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { NutritionTargetsController } from './nutrition-targets.controller';
import { NutritionTargetsService } from './nutrition-targets.service';

/**
 * Nutrition targets module — BMR/TDEE modelling and the daily kcal, macro and
 * water goals derived from it. Exports {@link NutritionTargetsService} so the
 * daily-metrics health score and the home feed measure progress against the
 * same targets the user sees.
 */
@Module({
  imports: [ProfilesModule, GoalsModule],
  controllers: [NutritionTargetsController],
  providers: [NutritionTargetsService],
  exports: [NutritionTargetsService],
})
export class NutritionTargetsModule {}
