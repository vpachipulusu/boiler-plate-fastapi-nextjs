// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { RATE_LIMIT_CONFIGS, resetRateLimitStore } from '@/lib/middleware/rate-limit';

const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

async function statuses(path: string, count: number): Promise<number[]> {
  const results: number[] = [];
  for (let attempt = 0; attempt < count; attempt += 1) {
    results.push((await call(path)).status);
  }
  return results;
}

describe('proxy /go/ outbound redirect', () => {
  beforeEach(() => resetRateLimitStore());

  it('lets a visitor reach /go/<id> without a session, with the security headers', async () => {
    const response = await call('/go/offer_1');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
  });

  it('rate limits /go/ with the general policy: exactly the 201st request is refused', async () => {
    const limit = RATE_LIMIT_CONFIGS.general.maxRequests;
    expect(limit).toBe(200);

    const results = await statuses('/go/offer_1', limit + 1);

    expect(results.slice(0, limit).every((status) => status === 200)).toBe(true);
    expect(results[limit]).toBe(429);
  });

  it('answers a refused /go/ request uncached and with the security headers', async () => {
    await statuses('/go/offer_1', RATE_LIMIT_CONFIGS.general.maxRequests);

    const response = await call('/go/offer_1');

    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('does not let /go/ traffic feed the auth bucket: the 6th auth attempt is the first refused', async () => {
    await statuses('/go/offer_1', 50);

    const results = await statuses('/api/auth/clear-session', 6);

    expect(results).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('does not let an exhausted auth bucket block /go/', async () => {
    await statuses('/api/auth/clear-session', 6);

    expect((await call('/go/offer_1')).status).toBe(200);
  });

  it('keeps the api and general buckets apart too', async () => {
    await statuses('/go/offer_1', 150);

    const results = await statuses('/api/other', RATE_LIMIT_CONFIGS.api.maxRequests + 1);

    expect(results.slice(0, -1).every((status) => status === 401)).toBe(true);
    expect(results.at(-1)).toBe(429);
  });

  it('does not widen the /api allowlist: look-alike api paths still need authentication', async () => {
    expect((await call('/api/go/offer_1')).status).toBe(401);
  });

  it('does not rate limit unrelated public pages', async () => {
    expect(await statuses('/freebies', 250)).not.toContain(429);
  });
});
