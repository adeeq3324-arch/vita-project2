import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Context attached to a reported event, so an error is traceable to a request. */
export interface ErrorContext {
  /** Correlation id, matching the `x-request-id` on the response. */
  requestId?: string;
  /** The authenticated caller, when there is one. */
  userId?: string;
  method?: string;
  path?: string;
  /** HTTP status the client was ultimately given. */
  status?: number;
}

/** A DSN decomposed into the parts the ingest endpoint needs. */
interface Dsn {
  publicKey: string;
  projectId: string;
  envelopeUrl: string;
}

/**
 * Parses a Sentry DSN: `https://<publicKey>@<host>/<projectId>`.
 *
 * Returns null rather than throwing on a malformed value: a typo in a
 * monitoring credential must degrade to "no error tracking", never to an
 * application that refuses to boot. The failure is logged loudly instead.
 */
const parseDsn = (dsn: string): Dsn | null => {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, '');
    if (!url.username || !projectId) {
      return null;
    }
    return {
      publicKey: url.username,
      projectId,
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
};

/** Frames pointing into the runtime or dependencies, not into this application. */
const isApplicationFrame = (line: string): boolean =>
  !line.includes('node_modules') && !line.includes('node:internal');

/**
 * Error tracking over the Sentry envelope API.
 *
 * Written against the wire format rather than the vendor SDK, for the same
 * reason the AI layer talks to model providers over plain HTTP: the SDK pulls
 * in an OpenTelemetry tree and patches the runtime at import time, which is a
 * large amount of machinery — and a large amount of startup risk — for what is
 * one authenticated POST per error. Any Sentry-compatible ingest (Sentry itself,
 * GlitchTip, Bugsink) is configured by changing one environment variable.
 *
 * Reporting is **fire-and-forget and never throws**. An exception being handled
 * is already a bad moment; failing to *report* it must not turn a 500 the client
 * would have understood into a crash. Delivery failures are logged locally,
 * where the platform's log collector still captures them.
 */
@Injectable()
export class ErrorTrackingService implements OnModuleInit {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private readonly dsn: Dsn | null;
  private readonly environment: string;
  private readonly release?: string;
  private readonly sampleRate: number;
  private readonly timeoutMs: number;
  private readonly serverName = hostname();

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('observability.sentryDsn');
    this.dsn = raw ? parseDsn(raw) : null;

    if (raw && !this.dsn) {
      this.logger.error('SENTRY_DSN is malformed; error tracking is disabled.');
    }

    this.environment = this.config.get<string>('observability.environment', 'development');
    this.release = this.config.get<string>('observability.release');
    this.sampleRate = this.config.get<number>('observability.sampleRate', 1);
    this.timeoutMs = this.config.get<number>('observability.timeoutMs', 5_000);
  }

  onModuleInit(): void {
    this.logger.log(
      this.enabled
        ? `Error tracking enabled (environment: ${this.environment}).`
        : 'Error tracking disabled: no SENTRY_DSN configured.',
    );
  }

  /** Whether events are actually delivered anywhere. */
  get enabled(): boolean {
    return this.dsn !== null;
  }

  /**
   * Reports an exception.
   *
   * Deliberately not awaited by callers: the response to the client should not
   * wait on a third-party HTTP call. The returned promise is exposed only so
   * tests can await delivery.
   */
  capture(error: unknown, context: ErrorContext = {}): Promise<void> {
    if (!this.dsn || Math.random() >= this.sampleRate) {
      return Promise.resolve();
    }
    return this.send(this.buildEvent(error, context)).catch((failure: unknown) => {
      this.logger.warn(
        `Could not deliver error report: ${
          failure instanceof Error ? failure.message : 'Unknown error'
        }`,
      );
    });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private buildEvent(error: unknown, context: ErrorContext): Record<string, unknown> {
    const normalised = error instanceof Error ? error : new Error(String(error));

    return {
      event_id: randomUUID().replace(/-/g, ''),
      timestamp: Date.now() / 1000,
      platform: 'node',
      level: 'error',
      logger: 'vital-ai-api',
      environment: this.environment,
      server_name: this.serverName,
      ...(this.release ? { release: this.release } : {}),
      exception: {
        values: [
          {
            type: normalised.name,
            value: normalised.message,
            stacktrace: { frames: this.buildFrames(normalised) },
          },
        ],
      },
      // Indexed and searchable in the dashboard: these are the dimensions an
      // on-call engineer filters by first.
      tags: {
        ...(context.status !== undefined ? { status: String(context.status) } : {}),
        ...(context.method ? { method: context.method } : {}),
      },
      // The correlation id is what ties a reported event back to the request
      // logs, so it is deliberately both a tag and part of the payload.
      ...(context.requestId ? { transaction: `${context.method ?? ''} ${context.path ?? ''}`.trim() } : {}),
      request: {
        ...(context.path ? { url: context.path } : {}),
        ...(context.method ? { method: context.method } : {}),
      },
      // Never the email or any profile field: an error report is not a place
      // for personal data. The id is enough to find the account internally.
      ...(context.userId ? { user: { id: context.userId } } : {}),
      extra: {
        ...(context.requestId ? { requestId: context.requestId } : {}),
      },
    };
  }

  /**
   * Stack frames, innermost last — the order Sentry renders them in.
   *
   * Frames inside `node_modules` and the Node runtime are marked as not
   * in-application so the dashboard collapses them, leaving the application's
   * own frames as the visible cause.
   */
  private buildFrames(error: Error): Array<Record<string, unknown>> {
    const lines = (error.stack ?? '').split('\n').slice(1);

    return lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith('at '))
      .map((line) => ({
        filename: line,
        in_app: isApplicationFrame(line),
      }))
      .reverse();
  }

  /**
   * POSTs one envelope: a header line, an item header, then the payload, each
   * newline-delimited. Bounded by a timeout so a slow ingest endpoint can never
   * hold a request handler open.
   */
  private async send(event: Record<string, unknown>): Promise<void> {
    if (!this.dsn) {
      return;
    }

    const envelope = [
      JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: 'event', content_type: 'application/json' }),
      JSON.stringify(event),
    ].join('\n');

    const response = await fetch(this.dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': [
          'Sentry sentry_version=7',
          `sentry_key=${this.dsn.publicKey}`,
          'sentry_client=vital-ai-api/1.0',
        ].join(', '),
      },
      body: envelope,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`ingest responded ${response.status}`);
    }
  }
}
