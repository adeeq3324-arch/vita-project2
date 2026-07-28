import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { DRIZZLE, type Database } from '../database/database.constants';
import { REDIS_CLIENT } from '../redis/redis.constants';

export type ComponentStatus = 'up' | 'down';

export interface ComponentHealth {
  status: ComponentStatus;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
  };
}

const CHECK_TIMEOUT_MS = 3000;

/**
 * Liveness/readiness logic. Actively probes every critical dependency
 * (Postgres, Redis) with a bounded timeout and reports each component's status
 * independently so operators can pinpoint outages.
 */
@Injectable()
export class HealthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const healthy = database.status === 'up' && redis.status === 'up';

    return {
      status: healthy ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      await this.withTimeout(this.db.execute(sql`select 1`), 'database');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', error: this.toMessage(error) };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    try {
      const pong = await this.withTimeout(this.redis.ping(), 'redis');
      return pong === 'PONG' ? { status: 'up' } : { status: 'down', error: `Unexpected reply: ${pong}` };
    } catch (error) {
      return { status: 'down', error: this.toMessage(error) };
    }
  }

  private withTimeout<T>(promise: PromiseLike<T>, component: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${component} health check timed out after ${CHECK_TIMEOUT_MS}ms`)),
        CHECK_TIMEOUT_MS,
      );
      timer.unref?.();
    });
    return Promise.race([Promise.resolve(promise), timeout]);
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
