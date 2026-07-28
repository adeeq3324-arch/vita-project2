import { Module } from '@nestjs/common';
import { AiContextModule } from '../ai-context/ai-context.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

/**
 * AI health coach module — conversations, history, and streamed replies.
 *
 * No queue and no job ledger here: a coach reply is answered live rather than
 * generated in the background, because the value of it is that the user watches
 * it arrive.
 */
@Module({
  imports: [AiContextModule],
  controllers: [CoachController],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
