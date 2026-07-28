import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  JOB_MONTHLY_SNAPSHOT_SWEEP,
  JOB_WEEKLY_SNAPSHOT_SWEEP,
  QUEUE_PROGRESS,
} from '../queue/queue.constants';
import { ProgressService } from './progress.service';

/**
 * One sweep at a time. Each iterates every active user, so running two
 * concurrently would multiply database load for no gain in wall-clock time.
 */
const CONCURRENCY = 1;

/**
 * Worker for the progress queue: the two scheduled snapshot roll-ups.
 *
 * Neither job produces anything a client is waiting on — snapshots are history, and
 * the Progress tab is computed live — so there is no job ledger entry and no status
 * to mirror. A failed sweep is retried by BullMQ, and the roll-up is idempotent, so
 * a retry recomputes rather than duplicating.
 */
@Processor(QUEUE_PROGRESS, { concurrency: CONCURRENCY })
export class ProgressProcessor extends WorkerHost {
  private readonly logger = new Logger(ProgressProcessor.name);

  constructor(private readonly progress: ProgressService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_WEEKLY_SNAPSHOT_SWEEP:
        await this.sweep('week');
        return;
      case JOB_MONTHLY_SNAPSHOT_SWEEP:
        await this.sweep('month');
        return;
      default:
        // An unrecognised name means a producer and this worker have drifted
        // apart. Failing loudly beats silently discarding the work.
        throw new Error(`Unknown job "${job.name}" on ${QUEUE_PROGRESS}.`);
    }
  }

  private async sweep(period: 'week' | 'month'): Promise<void> {
    this.logger.log(`Rolling up the completed ${period} for active users`);
    await this.progress.sweepCompletedPeriod(period);
  }
}
