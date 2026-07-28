import { Global, Module } from '@nestjs/common';
import { AiJobsService } from './ai-jobs.service';

/**
 * The background-job ledger. Global because every generating feature — meal
 * plans, supplement plans, all three scanners — records its work through the
 * same service, and a shared lifecycle is only worth having if nothing can opt
 * out of it.
 */
@Global()
@Module({
  providers: [AiJobsService],
  exports: [AiJobsService],
})
export class AiJobsModule {}
