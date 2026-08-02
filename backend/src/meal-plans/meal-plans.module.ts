import { Module } from '@nestjs/common';
import { AiContextModule } from '../ai-context/ai-context.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SpoonacularModule } from '../spoonacular/spoonacular.module';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansProcessor } from './meal-plans.processor';
import { MealPlansService } from './meal-plans.service';

/**
 * Meal plans module — AI-generated weeks of meals.
 *
 * The controller and the worker share one service: the request path only
 * reserves the row and enqueues, and the worker calls back into the same object
 * to do the generation, so the rules about what a plan may contain live in a
 * single place regardless of which side is running.
 *
 * The food knowledge base sits behind both: the model names and times the
 * dishes, and everything it cannot honestly know about them — the photograph,
 * the measured macros, the published method — is looked up there.
 */
@Module({
  imports: [AiContextModule, ProfilesModule, SpoonacularModule],
  controllers: [MealPlansController],
  providers: [MealPlansService, MealPlansProcessor],
  exports: [MealPlansService],
})
export class MealPlansModule {}
