import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AiJobsService } from '../ai-jobs/ai-jobs.service';
import { QUEUE_SCAN, type ScanJobData } from '../queue/queue.constants';
import { ScannerService } from './scanner.service';

/**
 * Scans are short calls, so more of them can be in flight than a plan
 * generation without straining an upstream rate limit.
 */
const CONCURRENCY = 4;

/**
 * Worker for scans that could not be answered on the request thread.
 *
 * Reached only when an inline attempt ran past its budget or hit a rate limit —
 * the ordinary path answers the request directly. It calls the very same
 * analysis the inline attempt was running, so a deferred scan produces an
 * identical result, just later.
 *
 * No status mirror: a scan has no domain row until there is a result to write
 * into it, so the `ai_jobs` entry is the only thing the client polls.
 */
@Processor(QUEUE_SCAN, { concurrency: CONCURRENCY })
export class ScannerProcessor extends WorkerHost {
  private readonly logger = new Logger(ScannerProcessor.name);

  constructor(
    private readonly scanner: ScannerService,
    private readonly aiJobs: AiJobsService,
  ) {
    super();
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    const { aiJobId, userId, scanType, imagePath, barcode } = job.data;
    this.logger.log(`Analysing deferred ${scanType} scan (attempt ${job.attemptsMade + 1})`);

    await this.aiJobs.track(aiJobId, null, () => {
      if (scanType === 'barcode') {
        if (!barcode) {
          throw new Error('A barcode scan job arrived without a barcode.');
        }
        return this.scanner.runBarcodeScan(userId, barcode);
      }

      if (!imagePath) {
        throw new Error(`A ${scanType} scan job arrived without an image.`);
      }
      return this.scanner.runPhotoScan(userId, scanType, imagePath);
    });
  }
}
