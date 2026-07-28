import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_REMINDER_SWEEP, QUEUE_REMINDER } from '../queue/queue.constants';

/**
 * Every minute, on the minute.
 *
 * Reminders are set to a minute, so the sweep has to run at least that often for a
 * nudge to arrive when the user asked for it. It is also cheap enough to justify:
 * the query behind it is a single indexed range scan that returns nothing at all in
 * the overwhelming majority of minutes.
 */
const SWEEP_PATTERN = '* * * * *';

/**
 * Registers the repeatable reminder sweep.
 *
 * The schedule lives in Redis alongside the queue, not in this process, which is what
 * makes it safe to run several API instances: `upsertJobScheduler` is keyed, so every
 * instance registering the same scheduler at boot converges on one entry rather than
 * producing one sweep per replica — which would otherwise mean every reminder being
 * considered once per instance, every minute.
 */
@Injectable()
export class RemindersScheduler implements OnModuleInit {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(@InjectQueue(QUEUE_REMINDER) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        JOB_REMINDER_SWEEP,
        { pattern: SWEEP_PATTERN, tz: 'UTC' },
        {
          name: JOB_REMINDER_SWEEP,
          // A sweep that has not run by the time the next one is due is worthless:
          // the later one covers everything the earlier one would have. One retry
          // guards a transient database blip; more would only build a backlog.
          opts: { attempts: 2, removeOnComplete: { count: 60 } },
        },
      );
      this.logger.log(`Reminder sweep scheduled (${SWEEP_PATTERN} UTC)`);
    } catch (error) {
      // A scheduler that cannot be registered must not stop the API booting:
      // reminders remain fully manageable, they simply will not be delivered until
      // the next successful start re-registers this. Logged as an error so the gap
      // in delivery is not silent.
      this.logger.error(
        `Could not register the reminder sweep: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
