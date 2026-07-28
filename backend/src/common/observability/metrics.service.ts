import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

/**
 * Latency buckets, seconds.
 *
 * Chosen around this API's actual shape rather than the library default: most
 * endpoints are a cached read or one indexed query (tens of milliseconds), while
 * the model-backed ones run to twenty seconds by design. Buckets either side of
 * both clusters are what make a p95 meaningful instead of a number derived from
 * two overflowing buckets.
 */
const LATENCY_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30];

/**
 * Application metrics, exposed in Prometheus text format.
 *
 * One registry owned here rather than the library's global default, so tests can
 * construct an isolated instance and metrics from a previous run can never leak
 * into the next.
 *
 * Cardinality is the thing being guarded throughout: labels are always the
 * *route template* (`/api/v1/foods/:id`), never the resolved path. Labelling by
 * resolved path would mint a new time series per food id and eventually take the
 * scrape — and then the monitoring system — down.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  /** Request counts by route, method and status class. */
  private readonly httpRequests = new Counter({
    name: 'vital_http_requests_total',
    help: 'Total HTTP requests handled.',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  /** End-to-end handler latency. */
  private readonly httpDuration = new Histogram({
    name: 'vital_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: LATENCY_BUCKETS,
    registers: [this.registry],
  });

  /** Requests currently being served — the queue depth of the process. */
  private readonly httpInFlight = new Gauge({
    name: 'vital_http_requests_in_flight',
    help: 'HTTP requests currently in flight.',
    registers: [this.registry],
  });

  /**
   * Cache outcomes. The ratio of these two is the single most useful number for
   * deciding whether a TTL is doing its job.
   */
  private readonly cacheEvents = new Counter({
    name: 'vital_cache_events_total',
    help: 'Cache reads by outcome.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });

  /** Rate-limit rejections, by which budget refused the request. */
  private readonly rateLimited = new Counter({
    name: 'vital_rate_limited_total',
    help: 'Requests rejected by a rate limiter.',
    labelNames: ['throttler'] as const,
    registers: [this.registry],
  });

  /** Background job outcomes, by queue and result. */
  private readonly jobs = new Counter({
    name: 'vital_jobs_total',
    help: 'Background jobs processed, by queue and outcome.',
    labelNames: ['queue', 'outcome'] as const,
    registers: [this.registry],
  });

  constructor() {
    // Process-level series: event-loop lag, heap, handles, GC. Event-loop lag in
    // particular is what distinguishes "the database is slow" from "this process
    // is saturated", and the two have opposite remedies.
    collectDefaultMetrics({ register: this.registry, prefix: 'vital_' });
  }

  /** Records one finished request. */
  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  requestStarted(): void {
    this.httpInFlight.inc();
  }

  requestFinished(): void {
    this.httpInFlight.dec();
  }

  recordCacheHit(): void {
    this.cacheEvents.inc({ outcome: 'hit' });
  }

  recordCacheMiss(): void {
    this.cacheEvents.inc({ outcome: 'miss' });
  }

  /** A cache read that failed outright — Redis unreachable or a bad payload. */
  recordCacheError(): void {
    this.cacheEvents.inc({ outcome: 'error' });
  }

  recordRateLimited(throttler: string): void {
    this.rateLimited.inc({ throttler });
  }

  recordJob(queue: string, outcome: 'completed' | 'failed'): void {
    this.jobs.inc({ queue, outcome });
  }

  /** The full registry in Prometheus exposition format. */
  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
