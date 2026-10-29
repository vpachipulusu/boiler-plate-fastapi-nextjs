// @vitest-environment node
/** the outbound click wrapper: request shape, outcome mapping and what it never leaks. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const headerValues = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => ({ value: 'visitor-session-cookie' })) })),
  headers: vi.fn(async () => ({ get: (name: string) => headerValues.get(name) ?? null })),
}));

import { logger } from '@/lib/logger';
import { recordOutboundClick } from '@/lib/api/outbound';

const DETAILS = { referrerHost: 'news.example', userAgentClass: 'MOBILE' } as const;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const OK_BODY = { success: true, data: { destination_url: 'https://a.example/' } };

describe('recordOutboundClick', () => {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

  beforeEach(() => {
    vi.stubEnv('BACKEND_API_URL', 'http://backend.test');
    vi.stubEnv('BACKEND_INTERNAL_KEY', 'server-key');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    headerValues.clear();
    vi.clearAllMocks();
  });

  it('posts the coarse details with the internal key, no session and no cookie', async () => {
    fetchMock.mockResolvedValue(
      json({ success: true, data: { destination_url: 'https://www.awin1.com/x?a=1' } })
    );

    const result = await recordOutboundClick('offer_1', DETAILS);

    expect(result).toEqual({ kind: 'redirect', destination: 'https://www.awin1.com/x?a=1' });
    const request = fetchMock.mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('http://backend.test/v1/catalogue/offers/offer_1/click');
    expect(request.headers.get('X-Internal-Key')).toBe('server-key');
    expect(request.headers.get('X-Session-Token')).toBeNull();
    expect(request.headers.get('cookie')).toBeNull();
    expect(await request.json()).toEqual({
      referrer_host: 'news.example',
      user_agent_class: 'MOBILE',
    });
  });

  it('forwards the platform-provided client address on Vercel, for the backend rate limit', async () => {
    vi.stubEnv('VERCEL', '1');
    headerValues.set('x-vercel-forwarded-for', '203.0.113.9');
    headerValues.set('x-forwarded-for', '198.51.100.1');
    headerValues.set('x-client-ip', '192.0.2.99');
    fetchMock.mockResolvedValue(json(OK_BODY));

    await recordOutboundClick('offer_1', DETAILS);

    expect(fetchMock.mock.calls[0][0].headers.get('X-Client-IP')).toBe('203.0.113.9');
  });

  it('does not trust forwarded headers outside Vercel', async () => {
    headerValues.set('x-forwarded-for', '198.51.100.1');
    headerValues.set('x-client-ip', '192.0.2.99');
    fetchMock.mockResolvedValue(json(OK_BODY));

    await recordOutboundClick('offer_1', DETAILS);

    expect(fetchMock.mock.calls[0][0].headers.get('X-Client-IP')).toBeNull();
  });

  it('maps 404 to not_found', async () => {
    fetchMock.mockResolvedValue(json({ success: false, error: 'Offer not found' }, 404));

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({ kind: 'not_found' });
  });

  it('maps a 410 with the stub to ended and keeps the slug', async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          success: false,
          error: 'This offer has ended',
          expired: true,
          data: { slug: 'free-shampoo', title: 'x', category: { slug: 'beauty', name: 'B' } },
        },
        410
      )
    );

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'ended',
      slug: 'free-shampoo',
    });
  });

  it('treats a 410 without a readable slug as not_found', async () => {
    fetchMock.mockResolvedValue(json({ success: false, expired: true }, 410));

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({ kind: 'not_found' });
  });

  it('maps 429 to rate_limited', async () => {
    fetchMock.mockResolvedValue(json({ success: false, error: 'Too many requests' }, 429));

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'rate_limited',
    });
  });

  it.each([401, 422, 500, 503])('maps %s to unavailable', async (status) => {
    fetchMock.mockResolvedValue(json({ success: false, error: 'secret backend text' }, status));

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it.each([
    ['a missing destination', { success: true, data: {} }],
    ['an empty destination', { success: true, data: { destination_url: '' } }],
    ['a non-string destination', { success: true, data: { destination_url: 42 } }],
    ['no data', { success: true }],
  ])('maps a 200 with %s to unavailable', async (_name, body) => {
    fetchMock.mockResolvedValue(json(body));

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('maps a network failure to unavailable and logs no backend message', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:8000'));

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain('ECONNREFUSED');
  });

  it('is unavailable, and never calls the backend, without the internal key', async () => {
    vi.stubEnv('BACKEND_INTERNAL_KEY', '');

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is unavailable when the backend URL is not configured', async () => {
    vi.stubEnv('BACKEND_API_URL', '');

    await expect(recordOutboundClick('offer_1', DETAILS)).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
