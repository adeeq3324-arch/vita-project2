import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildRedisOptions } from '../redis/redis.constants';
import { ALL_QUEUES } from './queue.constants';

/**
 * Global BullMQ root module. Establishes the shared Redis-backed queue
 * connection and sensible default job options for the whole application.
 *
 * The Phase 3 queues are registered here rather than inside each feature module
 * so that producers and consumers of the same queue cannot end up configured
 * differently, and so a module that only *enqueues* work does not have to
 * declare the queue it is handing the job to.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisOptions(config),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 1000, age: 24 * 3600 },
          removeOnFail: { count: 5000 },
        },
      }),
    }),
    // Generation queues: meal plans, monthly supplement plans, and scans.
    BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
  ],
  exports: [BullModule],
})
export class QueueModule {}
