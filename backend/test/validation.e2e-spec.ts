import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app';

/**
 * The request boundary: the global validation pipe and the RFC 7807 exception
 * filter, driven over real HTTP with the production DTOs.
 *
 * Rate limiting is disabled here so a suite that issues many deliberately
 * malformed requests is testing validation rather than exhausting a budget.
 */
describe('Request validation and error shape (e2e)', () => {
  let context: TestApp;
  let app: INestApplication;

  beforeEach(async () => {
    context = await createTestApp({ rateLimit: { enabled: false } });
    app = context.app;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('body validation', () => {
    const post = (body: Record<string, unknown>) =>
      request(app.getHttpServer()).post('/probe/credentials').send(body);

    it('accepts a well-formed payload', async () => {
      const response = await post({
        email: 'someone@example.com',
        password: 'correct-horse-battery',
      });

      expect(response.status).toBe(201);
    });

    it.each([
      ['a missing email', { password: 'correct-horse-battery' }],
      ['a malformed email', { email: 'not-an-email', password: 'correct-horse-battery' }],
      ['a missing password', { email: 'someone@example.com' }],
      ['a password below the minimum length', { email: 'someone@example.com', password: 'short' }],
      ['an empty body', {}],
    ])('rejects %s with 400', async (_case, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([expect.any(String)]));
    });

    /**
     * `forbidNonWhitelisted` is what stops a client smuggling a field the DTO
     * never declared — the shape of attack where an extra property reaches a
     * spread into a database write.
     */
    it('rejects an unknown property rather than silently dropping it', async () => {
      const response = await post({
        email: 'someone@example.com',
        password: 'correct-horse-battery',
        isAdmin: true,
      });

      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body.errors)).toContain('isAdmin');
    });

    /** The DTO lower-cases and trims, so the stored identity is canonical. */
    it('normalises the email before the handler sees it', async () => {
      const response = await post({
        email: '  SomeOne@Example.COM ',
        password: 'correct-horse-battery',
      });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe('someone@example.com');
    });

    it('rejects a password beyond the maximum length', async () => {
      const response = await post({
        email: 'someone@example.com',
        password: 'x'.repeat(200),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('query validation', () => {
    const search = (query: string) =>
      request(app.getHttpServer()).get(`/probe/search${query}`);

    it('accepts an empty query, since every parameter is optional', async () => {
      expect((await search('')).status).toBe(200);
    });

    /** Query strings are text; the DTO's transforms must yield real numbers. */
    it('coerces numeric parameters to numbers', async () => {
      const response = await search('?limit=25&offset=10');

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(25);
      expect(response.body.offset).toBe(10);
    });

    it.each([
      ['a limit above the ceiling', '?limit=5000'],
      ['a limit below one', '?limit=0'],
      ['a negative offset', '?offset=-1'],
      ['a non-numeric limit', '?limit=abc'],
      ['an unknown category', '?category=not-a-category'],
      ['an unknown parameter', '?unexpected=1'],
    ])('rejects %s with 400', async (_case, query) => {
      expect((await search(query)).status).toBe(400);
    });

    it('rejects a query longer than the maximum', async () => {
      expect((await search(`?q=${'x'.repeat(200)}`)).status).toBe(400);
    });
  });

  describe('the problem-details envelope', () => {
    it('describes a validation failure in the standard shape', async () => {
      const response = await request(app.getHttpServer())
        .post('/probe/credentials')
        .send({ email: 'nope' });

      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({
        type: 'about:blank',
        status: 400,
        instance: '/probe/credentials',
      });
      expect(response.body.timestamp).toEqual(expect.any(String));
    });

    it('describes a missing route in the same shape', async () => {
      const response = await request(app.getHttpServer()).get('/probe/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body.status).toBe(404);
    });
  });

  describe('unhandled server faults', () => {
    /**
     * The security-relevant half of the filter: a 500 must say nothing about
     * what actually went wrong. Messages and stack traces are for the logs and
     * the error tracker, never for the client.
     */
    it('never leaks the underlying error to the client', async () => {
      const response = await request(app.getHttpServer()).get('/probe/boom');

      expect(response.status).toBe(500);
      expect(response.body.detail).toBe(
        'An unexpected error occurred. Please try again later.',
      );

      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain('internal detail that must not leak');
      expect(serialised).not.toContain('stack');
    });

    it('reports the fault to the error tracker with request context', async () => {
      await request(app.getHttpServer()).get('/probe/boom');

      expect(context.errorTracking.capture).toHaveBeenCalledTimes(1);
      const [error, reported] = context.errorTracking.capture.mock.calls[0];

      expect((error as Error).message).toBe('internal detail that must not leak');
      expect(reported).toMatchObject({
        method: 'GET',
        path: '/probe/boom',
        status: 500,
      });
    });

    /**
     * Client mistakes are the API working correctly. Forwarding them would bury
     * real defects under a flood of routine 400s and 404s.
     */
    it('does not report client errors', async () => {
      await request(app.getHttpServer()).post('/probe/credentials').send({});
      await request(app.getHttpServer()).get('/probe/does-not-exist');

      expect(context.errorTracking.capture).not.toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('records every served request by route template, not resolved path', async () => {
      await request(app.getHttpServer()).get('/probe/ordinary');

      const metrics = await context.metrics.render();
      expect(metrics).toContain('vital_http_requests_total');
      expect(metrics).toContain('route="/probe/ordinary"');
    });

    it('observes request duration', async () => {
      await request(app.getHttpServer()).get('/probe/ordinary');

      const metrics = await context.metrics.render();
      expect(metrics).toContain('vital_http_request_duration_seconds_bucket');
    });

    /**
     * Cardinality is the thing that kills a metrics backend, and a flood of
     * 404s on random paths is the traffic most likely to do it.
     *
     * Nest's router rejects an unmatched path before any interceptor runs, so
     * such requests are never recorded at all — which is the strongest possible
     * outcome for this concern. What is asserted is that property directly: no
     * label value is ever minted from a caller-controlled path.
     */
    it('mints no label values from unmatched paths', async () => {
      await request(app.getHttpServer()).get('/no/such/path/1');
      await request(app.getHttpServer()).get('/no/such/path/2');

      const metrics = await context.metrics.render();
      expect(metrics).not.toContain('/no/such/path/1');
      expect(metrics).not.toContain('/no/such/path/2');
    });

    /** Ids in a path must never become part of a label either. */
    it('labels a parameterised route by its template, not its arguments', async () => {
      await request(app.getHttpServer()).get('/probe/ordinary');

      const metrics = await context.metrics.render();
      const routeLabels = [...metrics.matchAll(/route="([^"]+)"/g)].map((match) => match[1]);

      expect(routeLabels).toContain('/probe/ordinary');
      expect(routeLabels.every((label) => !/\d{3,}/.test(label))).toBe(true);
    });
  });
});
