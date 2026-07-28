import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AiJobsService } from '../ai-jobs/ai-jobs.service';
import { supplementPlans } from '../database/schema';
import {
  JOB_GENERATE_SUPPLEMENT_PLAN,
  JOB_MONTHLY_SUPPLEMENT_SWEEP,
  QUEUE_SUPPLEMENT_PLAN,
  type GenerationJobData,
} from '../queue/queue.constants';
import { SupplementPlansService } from './supplement-plans.service';

/** One model call per job; the upstream rate limit is the real constraint. */
const CONCURRENCY = 2;

/**
 * Worker for the supplement-plan queue.
 *
 * Handles two job kinds on one queue. The monthly sweep does not generate
 * anything itself — it fans out into ordinary generation jobs on this same
 * queue, so a scheduled plan and a user-requested one take an identical path and
 * there is only ever one implementation of what a regimen may contain.
 */
@Processor(QUEUE_SUPPLEMENT_PLAN, { concurrency: CONCURRENCY })
export class SupplementPlansProcessor extends WorkerHost {
  private readonly logger = new Logger(SupplementPlansProcessor.name);

  constructor(
    private readonly supplementPlans: SupplementPlansService,
    private readonly aiJobs: AiJobsService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    switch (job.name) {
      case JOB_GENERATE_SUPPLEMENT_PLAN:
        return this.generate(job);
      case JOB_MONTHLY_SUPPLEMENT_SWEEP:
        return this.sweep();
      default:
        // An unrecognised name means a producer and this worker have drifted
        // apart. Failing loudly beats silently discarding the work.
        throw new Error(`Unknown job "${job.name}" on ${QUEUE_SUPPLEMENT_PLAN}.`);
    }
  }

  private async generate(job: Job<GenerationJobData>): Promise<void> {
    const { aiJobId, userId, targetId } = job.data;
    this.logger.log(`Generating supplement plan ${targetId} (attempt ${job.attemptsMade + 1})`);

    await this.aiJobs.track(aiJobId, { table: supplementPlans, id: targetId }, () =>
      this.supplementPlans.runGeneration(userId, targetId),
    );
  }

  /**
   * The monthly trigger. Not tracked in the job ledger: it produces no artefact
   * of its own, only the generation jobs that each get their own entry.
   */
  private async sweep(): Promise<void> {
    await this.supplementPlans.sweepActiveUsers();
  }
}
