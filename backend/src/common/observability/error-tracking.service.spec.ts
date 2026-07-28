import { ConfigService } from '@nestjs/config';
import { ErrorTrackingService } from './error-tracking.service';

const DSN = 'https://publickey123@o1234.ingest.sentry.io/5678';

/** A ConfigService returning the supplied observability settings. */
const buildConfig = (overrides: Record<string, unknown> = {}): ConfigService => {
  const values: Record<string, unknown> = {
    'observability.sentryDsn': DSN,
    'observability.environment': 'test',
    'observability.release': '1.2.3',
    'observability.sampleRate': 1,
    'observability.timeoutMs': 5_000,
    ...overrides,
  };

  return {
    get: <T>(key: string, fallback?: T): T =>
      (values[key] === undefined ? fallback : values[key]) as T,
  } as ConfigService;
};

/** The fields of a reported event this suite asserts against. */
interface SentryEvent {
  event_id: string;
  platform: string;
  environment: string;
  release?: string;
  exception: {
    values: Array<{
      type: string;
      value: string;
      stacktrace: { frames: Array<{ filename: string; in_app: boolean }> };
    }>;
  };
  tags: Record<string, string>;
  request: Record<string, string>;
  user?: { id: string };
  extra: Record<string, string>;
}

/** The parsed envelope a `capture` produced: header, item header, payload. */
const readEnvelope = (
  fetchMock: jest.Mock,
): { url: string; auth: string; event: SentryEvent } => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const lines = (init.body as string).split('\n');

  return {
    url,
    auth: (init.headers as Record<string, string>)['x-sentry-auth'],
    event: JSON.parse(lines[2]) as SentryEvent,
  };
};

describe('ErrorTrackingService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('configuration', () => {
    it('is enabled with a well-formed DSN', () => {
      expect(new ErrorTrackingService(buildConfig()).enabled).toBe(true);
    });

    it('is disabled when no DSN is configured', () => {
      const service = new ErrorTrackingService(
        buildConfig({ 'observability.sentryDsn': undefined }),
      );
      expect(service.enabled).toBe(false);
    });

    /**
     * A typo in a monitoring credential must degrade to "no error tracking",
     * never to an application that refuses to boot — the alternative is an
     * outage caused by the thing meant to observe outages.
     */
    it.each([
      'not-a-url',
      'https://ingest.sentry.io/5678', // no public key
      'https://key@ingest.sentry.io', // no project id
    ])('is disabled rather than fatal for the malformed DSN %s', (dsn) => {
      expect(() => new ErrorTrackingService(buildConfig({ 'observability.sentryDsn': dsn })))
        .not.toThrow();

      const service = new ErrorTrackingService(buildConfig({ 'observability.sentryDsn': dsn }));
      expect(service.enabled).toBe(false);
    });

    it('sends nothing when disabled', async () => {
      const service = new ErrorTrackingService(
        buildConfig({ 'observability.sentryDsn': undefined }),
      );

      await service.capture(new Error('boom'));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('capture', () => {
    it('posts one envelope to the DSN’s ingest endpoint', async () => {
      const service = new ErrorTrackingService(buildConfig());

      await service.capture(new Error('database unreachable'));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { url, auth, event } = readEnvelope(fetchMock);

      expect(url).toBe('https://o1234.ingest.sentry.io/api/5678/envelope/');
      expect(auth).toContain('sentry_key=publickey123');
      expect(auth).toContain('sentry_version=7');
      expect(event.exception.values[0]).toMatchObject({
        type: 'Error',
        value: 'database unreachable',
      });
    });

    it('tags the event with the environment and release', async () => {
      await new ErrorTrackingService(buildConfig()).capture(new Error('boom'));

      const { event } = readEnvelope(fetchMock);
      expect(event.environment).toBe('test');
      expect(event.release).toBe('1.2.3');
      expect(event.platform).toBe('node');
    });

    it('carries the request context through to the report', async () => {
      await new ErrorTrackingService(buildConfig()).capture(new Error('boom'), {
        requestId: 'req-abc',
        userId: 'user-123',
        method: 'POST',
        path: '/api/v1/meal-logs',
        status: 500,
      });

      const { event } = readEnvelope(fetchMock);

      expect(event.extra.requestId).toBe('req-abc');
      expect(event.user).toEqual({ id: 'user-123' });
      expect(event.tags).toMatchObject({ status: '500', method: 'POST' });
      expect(event.request).toMatchObject({ method: 'POST', url: '/api/v1/meal-logs' });
    });

    /**
     * An error report is not a place for personal data. The account id is enough
     * to find the user internally; the email is not needed and must not leave
     * the system.
     */
    it('reports only the user id, never anything else about them', async () => {
      await new ErrorTrackingService(buildConfig()).capture(new Error('boom'), {
        userId: 'user-123',
      });

      const { event } = readEnvelope(fetchMock);
      expect(event.user).toBeDefined();
      expect(Object.keys(event.user ?? {})).toEqual(['id']);
      expect(JSON.stringify(event)).not.toContain('@');
    });

    it('marks application frames as in-app and dependency frames as not', async () => {
      const error = new Error('boom');
      error.stack = [
        'Error: boom',
        '    at MealLogsService.create (/app/src/meal-logs/meal-logs.service.ts:85:20)',
        '    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)',
        '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
      ].join('\n');

      await new ErrorTrackingService(buildConfig()).capture(error);

      const { event } = readEnvelope(fetchMock);
      const frames: Array<{ filename: string; in_app: boolean }> =
        event.exception.values[0].stacktrace.frames;

      const inApp = frames.filter((frame) => frame.in_app);
      expect(inApp).toHaveLength(1);
      expect(inApp[0].filename).toContain('meal-logs.service.ts');
    });

    it('normalises a thrown non-Error into a reportable exception', async () => {
      await new ErrorTrackingService(buildConfig()).capture('just a string');

      const { event } = readEnvelope(fetchMock);
      expect(event.exception.values[0].value).toBe('just a string');
    });

    /**
     * Reporting failures must never surface to the caller: the exception filter
     * is already handling one error, and failing to *report* it must not turn a
     * 500 the client would have understood into a crash.
     */
    it('swallows a rejected delivery', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(
        new ErrorTrackingService(buildConfig()).capture(new Error('boom')),
      ).resolves.toBeUndefined();
    });

    it('swallows a non-2xx response from the ingest endpoint', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 });

      await expect(
        new ErrorTrackingService(buildConfig()).capture(new Error('boom')),
      ).resolves.toBeUndefined();
    });

    it('drops everything at a zero sample rate', async () => {
      const service = new ErrorTrackingService(buildConfig({ 'observability.sampleRate': 0 }));

      await service.capture(new Error('boom'));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('gives every event its own id', async () => {
      const service = new ErrorTrackingService(buildConfig());

      await service.capture(new Error('one'));
      await service.capture(new Error('two'));

      const ids = fetchMock.mock.calls.map(
        ([, init]) => JSON.parse((init.body as string).split('\n')[0]).event_id,
      );

      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[0]).toMatch(/^[0-9a-f]{32}$/);
    });
  });
});
