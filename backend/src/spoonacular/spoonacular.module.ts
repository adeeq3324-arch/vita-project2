import { Module } from '@nestjs/common';
import { SpoonacularService } from './spoonacular.service';

/**
 * The food knowledge base — photography, measured nutrition and published
 * recipes for the dishes the model names.
 *
 * Its own module rather than a provider inside `MealPlansModule` because it is
 * not about meal plans: it answers "what is this dish, really", and the food
 * scanner and the diary are the obvious next callers. Nothing here depends on
 * planning, and nothing about planning is assumed.
 */
@Module({
  providers: [SpoonacularService],
  exports: [SpoonacularService],
})
export class SpoonacularModule {}
