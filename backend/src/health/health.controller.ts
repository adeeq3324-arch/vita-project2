import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService, type HealthReport } from './health.service';

/**
 * Health endpoint — `GET /health`. Returns 200 when every dependency is
 * reachable and 503 (Service Unavailable) when any component is down, with a
 * per-component breakdown. Version-neutral and unauthenticated (`@Public`) so
 * load balancers and orchestrators can probe it directly.
 */
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await this.health.check();
    res.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
