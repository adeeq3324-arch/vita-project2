import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Records timing and outcome for every HTTP request.
 *
 * An interceptor rather than middleware so the *route template* is available:
 * middleware runs before routing, where the only thing known is the resolved
 * path. Labelling metrics with resolved paths would create one time series per
 * id in the system, which is the standard way to bring down a Prometheus.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const start = process.hrtime.bigint();
    const route = this.routeTemplate(request);
    const method = request.method;

    this.metrics.requestStarted();

    // `tap` covers success and error alike; the status is read at completion
    // because an exception filter may still change it after the handler returns.
    const record = (): void => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.recordHttpRequest(method, route, response.statusCode, seconds);
      this.metrics.requestFinished();
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }

  /**
   * The matched route pattern, e.g. `/api/v1/foods/:id`.
   *
   * Falls back to a constant rather than the resolved URL when no route matched
   * — a flood of 404s on random paths is exactly the case that would otherwise
   * mint unbounded label values.
   */
  private routeTemplate(request: Request): string {
    const path = (request.route as { path?: string } | undefined)?.path;
    if (!path) {
      return 'unmatched';
    }
    const base = (request.baseUrl ?? '').replace(/\/$/, '');
    return `${base}${path}` || path;
  }
}
