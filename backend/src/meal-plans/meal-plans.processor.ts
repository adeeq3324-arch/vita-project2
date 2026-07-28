import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AiJobsService } from '../ai-jobs/ai-jobs.service';
import { mealPlans } from '../database/schema';
import { QUEUE_MEAL_PLAN, type GenerationJobData } from '../queue/queue.constants';
import { MealPlansService } from './meal-plans.service';

/**
 * Worker for weekly meal-plan generation.
 *
 * Concurrency is held low deliberately: each job makes one long model call, so
 * the limit that matters is the upstream rate limit rather than this process's
 * CPU, and a burst of parallel requests would simply turn into a burst of 429s.
 */
const CONCURRENCY = 2;

@Processor(QUEUE_MEAL_PLAN, { concurrency: CONCURRENCY })
export class MealPlansProcessor extends WorkerHost {
  private readonly logger = new Logger(MealPlansProcessor.name);

  constructor(
    private readonly mealPlans: MealPlansService,
    private readonly aiJobs: AiJobsService,
  ) {
    super();
  }

  /**
   * The status lifecycle is applied by the job tracker rather than here, so the
   * processor is left with only the work itself. Errors propagate: the tracker
   * has already recorded the failure on both the ledger and the plan row, and
   * re-throwing is what lets BullMQ apply its retry policy.
   */
  async process(job: Job<GenerationJobData>): Promise<void> {
    const { aiJobId, userId, targetId } = job.data;
    this.logger.log(`Generating meal plan ${targetId} (attempt ${job.attemptsMade + 1})`);

    await this.aiJobs.track(aiJobId, { table: mealPlans, id: targetId }, () =>
      this.mealPlans.runGeneration(userId, targetId),
    );
  }
}
