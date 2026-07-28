import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  JOB_MONTHLY_SNAPSHOT_SWEEP,
  JOB_WEEKLY_SNAPSHOT_SWEEP,
  QUEUE_PROGRESS,
} from '../queue/queue.constants';

/**
 * Cron patterns for the two roll-ups.
 *
 * Both fire well into Monday / the 1st in UTC rather than at midnight, so that
 * users in zones behind UTC have finished their own week or month by the time the
 * sweep reaches them. The sweep resolves each user's boundary in their own zone
 * regardless, but firing early would simply mean rolling up a period they were
 * still living in, and doing that work twice.
 */
const WEEKLY_PATTERN = '30 4 * * 1';
const MONTHLY_PATTERN = '0 5 1 * *';

/**
 * Registers the repeatable weekly and monthly snapshot roll-ups.
 *
 * The schedules live in Redis alongside the queue, not in this process, which is
 * what makes it safe to run several API instances: `upsertJobScheduler` is keyed,
 * so every instance registering the same scheduler at boot converges on one entry
 * rather than producing one sweep per replica. It also means changing a pattern
 * here takes effect on the next deploy instead of leaving an orphaned schedule
 * behind.
 */
@Injectable()
export class ProgressScheduler implements OnModuleInit {
  private readonly logger = new Logger(ProgressScheduler.name);

  constructor(@InjectQueue(QUEUE_PROGRESS) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.register(JOB_WEEKLY_SNAPSHOT_SWEEP, WEEKLY_PATTERN);
    await this.register(JOB_MONTHLY_SNAPSHOT_SWEEP, MONTHLY_PATTERN);
  }

  /**
   * Registers one repeatable sweep.
   *
   * A scheduler that cannot be registered must not stop the API booting: roll-ups
   * still happen on demand whenever a user opens the Progress tab, and the next
   * successful start re-registers it. Logged as an error so it is not missed.
   */
  private async register(name: string, pattern: string): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(name, { pattern, tz: 'UTC' }, { name });
      this.logger.log(`${name} scheduled (${pattern} UTC)`);
    } catch (error) {
      this.logger.error(
        `Could not register ${name}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
