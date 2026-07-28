import { STATUS_CODES } from 'node:http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from '../http/problem-details';
import { ErrorTrackingService } from '../observability/error-tracking.service';

interface NestExceptionBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

/**
 * Catches every unhandled exception and maps it to a consistent RFC 7807
 * problem-details response. Client (4xx) errors surface their message; server
 * (5xx) errors are logged with full context but never leak internals to the
 * caller. No exception ever escapes as an unformatted stack trace.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly errorTracking: ErrorTrackingService,
  ) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, title, detail, errors } = this.resolve(exception);

    const requestId =
      (request as Request & { id?: string }).id ??
      (response.getHeader('x-request-id') as string | undefined);

    const problem: ProblemDetails = {
      type: 'about:blank',
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      ...(errors ? { errors } : {}),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, method: request.method, path: problem.instance, requestId },
        'Unhandled server exception',
      );

      // Only server faults are reported. A 404 or a rejected payload is the API
      // working correctly, and forwarding those would bury real defects under
      // routine client mistakes. Deliberately not awaited: the client's response
      // must not wait on a third-party HTTP call, and `capture` never throws.
      void this.errorTracking.capture(exception, {
        requestId,
        userId: (request as Request & { user?: AuthenticatedUser }).user?.id,
        method: request.method,
        path: problem.instance,
        status,
      });
    } else {
      this.logger.warn(
        { status, method: request.method, path: problem.instance, requestId },
        title,
      );
    }

    response.status(status).type(PROBLEM_CONTENT_TYPE).send(problem);
  }

  private resolve(exception: unknown): {
    status: number;
    title: string;
    detail: string;
    errors?: string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const title = STATUS_CODES[status] ?? exception.name;
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { status, title, detail: body };
      }

      const { message, error } = (body as NestExceptionBody) ?? {};

      if (Array.isArray(message)) {
        return { status, title: error ?? title, detail: title, errors: message };
      }

      return { status, title: error ?? title, detail: message ?? title };
    }

    // Unknown/non-HTTP errors: respond generically, never leak internals.
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return {
      status,
      title: STATUS_CODES[status] as string,
      detail: 'An unexpected error occurred. Please try again later.',
    };
  }
}
