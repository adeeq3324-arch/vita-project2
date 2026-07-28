import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.constants';
import {
  aiJobs,
  mealPlans,
  supplementPlans,
  type AiJob,
  type AiJobStatus,
  type AiJobType,
} from '../database/schema';

/**
 * A domain table whose own `status` column tracks a generation.
 *
 * Both generated artefacts expose the identical `idle → generating → ready |
 * failed` lifecycle, which is what lets one tracker keep either in step with the
 * job ledger without knowing anything else about them.
 */
export type GenerationTable = typeof mealPlans | typeof supplementPlans;

/** The domain row a job should keep in step with, if any. */
export interface StatusMirror {
  table: GenerationTable;
  id: string;
}

/** Message shown to a user when a job fails for a reason we cannot explain. */
const GENERIC_FAILURE = 'Generation failed. Please try again.';

/** Cap on stored error text, so a verbose upstream error cannot bloat the row. */
const MAX_ERROR_LENGTH = 500;

/**
 * The lifecycle of every piece of AI work, in one place.
 *
 * Two things have to agree about a job's state: the `ai_jobs` ledger, which is
 * how the platform accounts for what it asked the model to do, and the artefact
 * row the client is polling. Keeping the transitions here — rather than letting
 * each processor write both — is what guarantees they cannot disagree, in
 * particular that a crash mid-generation still leaves the client with a `failed`
 * it can act on instead of a plan stuck in `generating` forever.
 */
@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Opens the ledger entry for work about to be enqueued. */
  async enqueue(userId: string, type: AiJobType): Promise<AiJob> {
    const [job] = await this.db
      .insert(aiJobs)
      .values({ userId, type, status: 'queued' })
      .returning();
    return job;
  }

  /** The ledger entry, scoped to its owner. */
  async findOwned(userId: string, aiJobId: string): Promise<AiJob | undefined> {
    const job = await this.db.query.aiJobs.findFirst({ where: eq(aiJobs.id, aiJobId) });
    return job?.userId === userId ? job : undefined;
  }

  /**
   * Runs a processor's work with the full lifecycle applied around it.
   *
   * `work` returns the id of the row it produced, which becomes the ledger's
   * `result_ref_id`. Anything it throws is recorded and then re-thrown, so
   * BullMQ still sees the failure and can apply its own retry policy — a retried
   * attempt simply moves the job back to `processing` on its next pass.
   */
  async track(
    aiJobId: string,
    mirror: StatusMirror | null,
    work: () => Promise<string>,
  ): Promise<void> {
    await this.markProcessing(aiJobId, mirror);

    let resultRefId: string;
    try {
      resultRefId = await work();
    } catch (error) {
      const message = this.describe(error);
      this.logger.error(`AI job ${aiJobId} failed: ${message}`);
      await this.markFailed(aiJobId, mirror, message);
      throw error;
    }

    await this.markReady(aiJobId, mirror, resultRefId);
  }

  // ── transitions ───────────────────────────────────────────────────────────

  /**
   * Returns a job to `queued` after an inline attempt gave up on it.
   *
   * Used by the scanners, which try to answer on the request thread and hand the
   * work to a worker when the model is too slow. The ledger must show `queued`
   * again rather than `failed` — nothing has gone wrong, the work has simply
   * changed hands, and a client polling the job would otherwise be told to give
   * up on a scan that is still coming.
   */
  async requeue(aiJobId: string): Promise<void> {
    await this.setJobStatus(aiJobId, { status: 'queued', errorMessage: null });
  }

  async markProcessing(aiJobId: string, mirror: StatusMirror | null): Promise<void> {
    await this.setJobStatus(aiJobId, { status: 'processing', errorMessage: null });
    await this.setMirrorStatus(mirror, 'generating', null);
  }

  async markReady(
    aiJobId: string,
    mirror: StatusMirror | null,
    resultRefId: string,
  ): Promise<void> {
    await this.setJobStatus(aiJobId, { status: 'ready', resultRefId, errorMessage: null });
    await this.setMirrorStatus(mirror, 'ready', null);
  }

  async markFailed(
    aiJobId: string,
    mirror: StatusMirror | null,
    errorMessage: string,
  ): Promise<void> {
    const message = this.truncate(errorMessage);
    await this.setJobStatus(aiJobId, { status: 'failed', errorMessage: message });
    await this.setMirrorStatus(mirror, 'failed', message);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async setJobStatus(
    aiJobId: string,
    changes: { status: AiJobStatus; resultRefId?: string; errorMessage: string | null },
  ): Promise<void> {
    await this.db
      .update(aiJobs)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(aiJobs.id, aiJobId));
  }

  /**
   * Mirrors the transition onto the artefact row.
   *
   * Failures here are logged and swallowed on purpose: the ledger write has
   * already succeeded, and throwing would turn a cosmetic desync into a lost
   * job. The client's next poll re-reads the row either way.
   */
  private async setMirrorStatus(
    mirror: StatusMirror | null,
    status: 'generating' | 'ready' | 'failed',
    errorMessage: string | null,
  ): Promise<void> {
    if (!mirror) {
      return;
    }

    try {
      await this.db
        .update(mirror.table)
        .set({ status, errorMessage, updatedAt: new Date() })
        .where(eq(mirror.table.id, mirror.id));
    } catch (error) {
      this.logger.warn(
        `Could not mirror status "${status}" onto ${mirror.id}: ${this.describe(error)}`,
      );
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }
    return GENERIC_FAILURE;
  }

  private truncate(message: string): string {
    return message.length > MAX_ERROR_LENGTH
      ? `${message.slice(0, MAX_ERROR_LENGTH - 1)}…`
      : message;
  }
}
