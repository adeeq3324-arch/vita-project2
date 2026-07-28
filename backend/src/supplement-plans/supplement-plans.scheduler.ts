import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  JOB_MONTHLY_SUPPLEMENT_SWEEP,
  QUEUE_SUPPLEMENT_PLAN,
  type GenerationJobData,
} from '../queue/queue.constants';

/**
 * Cron for the monthly regeneration: 03:00 UTC on the 1st of each month.
 *
 * Early morning UTC is close to the quietest point in global traffic, and the
 * sweep resolves each user's month boundary in their own time zone anyway, so
 * the exact hour only decides when the load lands rather than who is included.
 */
const MONTHLY_PATTERN = '0 3 1 * *';

/**
 * Registers the repeatable monthly supplement sweep.
 *
 * The schedule lives in Redis alongside the queue, not in this process, which is
 * what makes it safe to run several API instances: `upsertJobScheduler` is
 * keyed, so every instance registering the same scheduler at boot converges on
 * one entry rather than producing one sweep per replica. It also means changing
 * the pattern here takes effect on the next deploy instead of leaving an
 * orphaned schedule behind.
 */
@Injectable()
export class SupplementPlansScheduler implements OnModuleInit {
  private readonly logger = new Logger(SupplementPlansScheduler.name);

  constructor(
    @InjectQueue(QUEUE_SUPPLEMENT_PLAN) private readonly queue: Queue<GenerationJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        JOB_MONTHLY_SUPPLEMENT_SWEEP,
        { pattern: MONTHLY_PATTERN, tz: 'UTC' },
        { name: JOB_MONTHLY_SUPPLEMENT_SWEEP },
      );
      this.logger.log(`Monthly supplement sweep scheduled (${MONTHLY_PATTERN} UTC)`);
    } catch (error) {
      // A scheduler that cannot be registered must not stop the API booting:
      // on-demand generation still works, and the next successful start
      // re-registers it. Logged as an error so it is not missed.
      this.logger.error(
        `Could not register the monthly supplement sweep: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
