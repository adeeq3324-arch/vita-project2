import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app';

/**
 * Rate limiting, driven over real HTTP through both guards in production order.
 *
 * The default per-route budget is configured down to 5 in the harness so a
 * suite can exhaust it without issuing hundreds of requests; the shared model
 * budget is 3 for the same reason.
 */
describe('Rate limiting (e2e)', () => {
  let context: TestApp;
  let app: INestApplication;

  beforeEach(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterEach(async () => {
    await app.close();
  });

  /** Issues `count` GETs and returns the status codes in order. */
  const hit = async (path: string, count: number, ip = '10.0.0.1'): Promise<number[]> => {
    const statuses: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('x-forwarded-for', ip);
      statuses.push(response.status);
    }
    return statuses;
  };

  describe('the per-route default budget', () => {
    it('allows requests up to the limit and refuses the next one', async () => {
      const statuses = await hit('/probe/ordinary', 6);

      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);
    });

    it('advertises the remaining allowance on every response', async () => {
      const first = await request(app.getHttpServer()).get('/probe/ordinary');

      expect(first.headers['x-ratelimit-limit']).toBe('5');
      expect(first.headers['x-ratelimit-remaining']).toBe('4');
      expect(first.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('tells a refused caller when to come back', async () => {
      await hit('/probe/ordinary', 5);
      const refused = await request(app.getHttpServer())
        .get('/probe/ordinary')
        .set('x-forwarded-for', '10.0.0.1');

      expect(refused.status).toBe(429);
      expect(refused.headers['retry-after']).toBeDefined();
    });

    /**
     * Budgets are per route, so a client hammering one endpoint cannot lock
     * itself out of the rest of the application.
     */
    it('does not spend one route’s budget on another', async () => {
      await hit('/probe/ordinary', 6);

      const other = await request(app.getHttpServer()).get('/probe/other');
      expect(other.status).toBe(200);
    });

    /** Limits are per caller: one heavy client must not throttle everyone else. */
    it('keeps separate budgets for separate addresses', async () => {
      const exhausted = await hit('/probe/ordinary', 6, '10.0.0.1');
      expect(exhausted[5]).toBe(429);

      const neighbour = await hit('/probe/ordinary', 1, '10.0.0.2');
      expect(neighbour[0]).toBe(200);
    });

    /**
     * The other half of that setting, and the dangerous one. A directly exposed
     * service must not believe a client's own `X-Forwarded-For`, or evading the
     * limiter is a matter of sending a different header value each time.
     */
    it('ignores a spoofed forwarding header when no proxy is trusted', async () => {
      await app.close();
      context = await createTestApp({ rateLimit: { trustProxy: false } });
      app = context.app;

      // Every request claims a fresh address; all of them must land in one
      // bucket, because the socket they arrived on is the same.
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const response = await request(app.getHttpServer())
          .get('/probe/ordinary')
          .set('x-forwarded-for', `203.0.113.${i}`);
        statuses.push(response.status);
      }

      expect(statuses[5]).toBe(429);
    });
  });

  describe('the shared model budget', () => {
    /**
     * The reason this budget is not route-scoped: a model call costs money
     * wherever it is made, so alternating between endpoints must not buy a
     * caller three times the allowance.
     */
    it('is spent jointly by every model-backed route', async () => {
      expect(await hit('/probe/model-a', 2)).toEqual([200, 200]);

      // One unit of the shared budget of three remains.
      expect(await hit('/probe/model-b', 1)).toEqual([200]);
      const exhausted = await hit('/probe/model-b', 1);
      expect(exhausted[0]).toBe(429);
    });

    /** Ordinary routes must not draw on the model budget at all. */
    it('is untouched by routes that did not opt in', async () => {
      await hit('/probe/ordinary', 5);

      expect(await hit('/probe/model-a', 1)).toEqual([200]);
    });
  });

  describe('the credential budget', () => {
    const credentials = { email: 'someone@example.com', password: 'correct-horse-battery' };

    it('is far stricter than the default allowance', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i += 1) {
        const response = await request(app.getHttpServer())
          .post('/probe/credentials')
          .send(credentials);
        statuses.push(response.status);
      }

      // Ten attempts allowed, the eleventh refused — not the default five.
      expect(statuses.filter((status) => status === 429)).toHaveLength(1);
      expect(statuses[9]).not.toBe(429);
      expect(statuses[10]).toBe(429);
    });
  });

  describe('infrastructure routes', () => {
    /**
     * A health probe is called on a fixed interval from a handful of addresses.
     * Throttling it would take a healthy instance out of rotation for the crime
     * of being monitored.
     */
    it('are never rate limited', async () => {
      const statuses = await hit('/probe/infrastructure', 25);

      expect(statuses.every((status) => status === 200)).toBe(true);
    });
  });

  describe('when rate limiting is switched off', () => {
    it('lets everything through', async () => {
      await app.close();
      context = await createTestApp({ rateLimit: { enabled: false } });
      app = context.app;

      const statuses = await hit('/probe/ordinary', 20);
      expect(statuses.every((status) => status === 200)).toBe(true);
    });
  });

  describe('when Redis is unreachable', () => {
    /**
     * Rate limiting is a protection, not a correctness requirement. A Redis
     * outage must not become an API outage, so the limiter fails open and the
     * request is served.
     */
    it('fails open rather than refusing traffic', async () => {
      jest
        .spyOn(context.redis, 'vitalThrottle')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      const statuses = await hit('/probe/ordinary', 10);
      expect(statuses.every((status) => status === 200)).toBe(true);
    });
  });

  describe('the 429 response', () => {
    it('is shaped like every other error the API returns', async () => {
      await hit('/probe/ordinary', 5);
      const refused = await request(app.getHttpServer())
        .get('/probe/ordinary')
        .set('x-forwarded-for', '10.0.0.1');

      expect(refused.status).toBe(429);
      expect(refused.headers['content-type']).toContain('application/problem+json');
      expect(refused.body).toMatchObject({
        status: 429,
        title: 'Too Many Requests',
        instance: '/probe/ordinary',
      });
      expect(refused.body.detail).toMatch(/try again in \d+ seconds?/i);
    });

    it('is counted as a rate-limit rejection in the metrics', async () => {
      await hit('/probe/ordinary', 6);

      const metrics = await context.metrics.render();
      expect(metrics).toMatch(/vital_rate_limited_total\{throttler="default"\} [1-9]/);
    });
  });
});
