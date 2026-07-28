import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Health module. Depends only on the globally-provided database and Redis
 * clients, so it needs no additional imports.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
