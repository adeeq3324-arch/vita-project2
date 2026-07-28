import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue, type Job } from 'bullmq';
import {
  JOB_DELIVER_REMINDER,
  JOB_REMINDER_SWEEP,
  QUEUE_REMINDER,
  type ReminderJobData,
} from '../queue/queue.constants';
import { CLAIM_BATCH_SIZE, RemindersService } from './reminders.service';

/**
 * Deliveries are network-bound, not CPU-bound, so several can be in flight at once.
 * Kept modest because each one is a call to an external push service, and a burst of
 * them is the fastest way to be rate-limited.
 */
const CONCURRENCY = 5;

/**
 * Most claims a single sweep will make.
 *
 * Bounds the work one minute's sweep can do, so a backlog — a long outage, or a
 * clock jump — drains over several minutes instead of one sweep trying to claim
 * every reminder in the table. Anything left is claimed by the next sweep a minute
 * later, since it is already due.
 */
const MAX_CLAIMS_PER_SWEEP = 2000;

/**
 * Worker for the reminder queue.
 *
 * Two job kinds on one queue, and the split between them is the design:
 *
 *  - **The sweep** claims due reminders in the database and fans each one out as its
 *    own delivery job. It performs no network I/O, so the minute's sweep cannot be
 *    held open by a slow push service.
 *  - **A delivery** sends exactly one notification. Isolating them means one user's
 *    unreachable device cannot delay anybody else's reminder, and the queue's
 *    concurrency — rather than a loop — decides how many go out at once.
 *
 * Deliveries are deliberately **not retried**. The claim has already advanced the
 * reminder's schedule, so a retry would risk delivering the same nudge twice, and a
 * duplicate push is a worse outcome than a missed one.
 */
@Processor(QUEUE_REMINDER, { concurrency: CONCURRENCY })
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly reminders: RemindersService,
    @InjectQueue(QUEUE_REMINDER) private readonly queue: Queue<ReminderJobData>,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    switch (job.name) {
      case JOB_REMINDER_SWEEP:
        return this.sweep();
      case JOB_DELIVER_REMINDER:
        return this.deliver(job);
      default:
        // An unrecognised name means a producer and this worker have drifted apart.
        // Failing loudly beats silently discarding the work.
        throw new Error(`Unknown job "${job.name}" on ${QUEUE_REMINDER}.`);
    }
  }

  /**
   * Claims and fans out everything due, in batches until the queue is drained or the
   * per-sweep ceiling is reached.
   */
  private async sweep(): Promise<void> {
    let claimed = 0;

    while (claimed < MAX_CLAIMS_PER_SWEEP) {
      const batch = await this.reminders.claimDue(new Date(), CLAIM_BATCH_SIZE);
      if (batch.length === 0) {
        break;
      }

      await this.queue.addBulk(
        batch.map((claim) => ({
          name: JOB_DELIVER_REMINDER,
          data: {
            reminderId: claim.reminderId,
            userId: claim.userId,
            dueAt: claim.dueAt.toISOString(),
          },
          // One attempt: see the class note on why a delivery is never retried.
          opts: { attempts: 1, removeOnComplete: { count: 500 } },
        })),
      );

      claimed += batch.length;

      // A short batch means the due set is exhausted; anything that becomes due
      // during this sweep belongs to the next one.
      if (batch.length < CLAIM_BATCH_SIZE) {
        break;
      }
    }

    if (claimed > 0) {
      this.logger.log(`Reminder sweep dispatched ${claimed} reminder(s)`);
    }
  }

  private async deliver(job: Job<ReminderJobData>): Promise<void> {
    const { reminderId, userId } = job.data;
    await this.reminders.deliver(reminderId, userId);
  }
}
