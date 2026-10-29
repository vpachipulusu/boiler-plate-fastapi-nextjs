// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit';

const call = (path: string) => proxy(new NextRequest(`http://localhost${path}`));

describe('proxy /go/ outbound redirect', () => {
  it('lets a visitor reach /go/<id> without a session, with the security headers', async () => {
    const response = await call('/go/offer_1');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
  });

  it('does not widen the /api allowlist: look-alike api paths still need authentication', async () => {
    const response = await call('/api/go/offer_1');

    expect(response.status).toBe(401);
  });

  it('does not rate limit unrelated public pages', async () => {
    expect((await call('/freebies')).status).toBe(200);
  });
  it('rate limits /go/ with the general policy and not any stricter one', async () => {
    const limit = RATE_LIMIT_CONFIGS.general.maxRequests;
    expect(limit).toBeGreaterThan(RATE_LIMIT_CONFIGS.api.maxRequests);

    const statuses: number[] = [];
    for (let attempt = 0; attempt <= limit + 1; attempt += 1) {
      statuses.push((await call(`/go/offer_${attempt}`)).status);
    }

    // Earlier tests in this file already spent a few tokens from the shared bucket.
    const firstDenied = statuses.indexOf(429);
    expect(firstDenied).toBeGreaterThanOrEqual(limit - 5);
    expect(firstDenied).toBeLessThanOrEqual(limit);
    expect(statuses.slice(0, firstDenied).every((status) => status === 200)).toBe(true);
  });
});
