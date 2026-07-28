import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { HealthConditionsModule } from '../health-conditions/health-conditions.module';
import { NutritionTargetsModule } from '../nutrition-targets/nutrition-targets.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UserContextService } from './user-context.service';

/**
 * Assembles the picture of a user that the AI layer generates against.
 *
 * Deliberately separate from {@link AiModule}: that module owns *how* the
 * platform talks to a model, this one owns *what it is told about the user*.
 * Keeping them apart is what lets the model service be swapped without touching
 * personalisation, and personalisation be changed without touching transport.
 */
@Module({
  imports: [ProfilesModule, GoalsModule, HealthConditionsModule, NutritionTargetsModule],
  providers: [UserContextService],
  exports: [UserContextService],
})
export class AiContextModule {}
