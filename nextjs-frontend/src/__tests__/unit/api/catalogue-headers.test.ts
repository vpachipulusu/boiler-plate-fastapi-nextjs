// @vitest-environment node
/**
 * What the catalogue wrapper actually puts on the wire: the internal key, never the visitor's session,
 * and the visitor address only from the platform's trusted header.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  headerValues: new Map<string, string>(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookiesGet })),
  headers: vi.fn(async () => ({ get: (name: string) => mocks.headerValues.get(name) ?? null })),
}));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { fetchCategories, fetchOffer, fetchOffers } from '@/lib/api/catalogue';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();
const sentRequest = (index = 0) => fetchMock.mock.calls[index][0];

beforeEach(() => {
  vi.stubEnv('BACKEND_API_URL', 'http://backend.test');
  vi.stubEnv('BACKEND_INTERNAL_KEY', 'server-key');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () =>
    json({ success: true, data: { items: [], total: 0, limit: 12, offset: 0 } })
  );
  mocks.cookiesGet.mockReturnValue({ value: 'visitor-session' });
  mocks.headerValues.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  mocks.cookiesGet.mockReset();
});

describe('catalogue requests', () => {
  it('sends the internal key and no session, even when the visitor has a session cookie', async () => {
    await fetchOffers({ limit: 12, offset: 0 });

    const request = sentRequest();
    expect(request.url).toBe('http://backend.test/v1/catalogue/offers?limit=12&offset=0');
    expect(request.headers.get('X-Internal-Key')).toBe('server-key');
    expect(request.headers.get('X-Session-Token')).toBeNull();
    expect(request.headers.get('cookie')).toBeNull();
    expect(mocks.cookiesGet).not.toHaveBeenCalled();
  });

  it('repeats the type parameter once per type', async () => {
    await fetchOffers({ types: ['free_sample', 'voucher'], postage: 'free' });

    const url = new URL(sentRequest().url);
    expect(url.searchParams.getAll('type')).toEqual(['free_sample', 'voucher']);
    expect(url.searchParams.get('postage')).toBe('free');
  });

  it('reads one offer and the categories from their own paths without a session', async () => {
    fetchMock.mockImplementation(async () => json({ success: true, data: [] }));
    await fetchCategories();
    fetchMock.mockImplementation(async () => json({ success: true, data: { slug: 'free-tea' } }));
    await fetchOffer('free-tea');

    expect(new URL(sentRequest(0).url).pathname).toBe('/v1/catalogue/categories');
    expect(new URL(sentRequest(1).url).pathname).toBe('/v1/catalogue/offers/free-tea');
    expect(sentRequest(0).headers.get('X-Session-Token')).toBeNull();
    expect(sentRequest(1).headers.get('X-Session-Token')).toBeNull();
    expect(mocks.cookiesGet).not.toHaveBeenCalled();
  });
});

describe('the visitor address', () => {
  it('forwards the platform address as X-Client-IP on Vercel', async () => {
    vi.stubEnv('VERCEL', '1');
    mocks.headerValues.set('x-vercel-forwarded-for', ' 203.0.113.7 ');

    await fetchOffers();

    expect(sentRequest().headers.get('X-Client-IP')).toBe('203.0.113.7');
  });

  it('forwards an IPv6 address too', async () => {
    vi.stubEnv('VERCEL', '1');
    mocks.headerValues.set('x-vercel-forwarded-for', '2001:db8::1');

    await fetchCategories();

    expect(sentRequest().headers.get('X-Client-IP')).toBe('2001:db8::1');
  });

  it('never takes the address from a header the client can set', async () => {
    vi.stubEnv('VERCEL', '1');
    mocks.headerValues.set('x-forwarded-for', '198.51.100.9');
    mocks.headerValues.set('x-real-ip', '198.51.100.9');
    mocks.headerValues.set('x-client-ip', '198.51.100.9');

    await fetchOffers();

    expect(sentRequest().headers.get('X-Client-IP')).toBeNull();
  });

  it('omits it off Vercel, where no header can be trusted', async () => {
    mocks.headerValues.set('x-vercel-forwarded-for', '203.0.113.7');

    await fetchOffers();

    expect(sentRequest().headers.get('X-Client-IP')).toBeNull();
  });

  it.each([
    ['absent', undefined],
    ['not an address', 'not-an-ip'],
    ['an injected header', '203.0.113.7\r\nX-Internal-Key: stolen'],
  ])('omits it when the platform header is %s', async (_name, value) => {
    vi.stubEnv('VERCEL', '1');
    if (value !== undefined) mocks.headerValues.set('x-vercel-forwarded-for', value);

    await fetchOffers();

    expect(sentRequest().headers.get('X-Client-IP')).toBeNull();
  });

  it('omits it without the internal key, as every other forwarded header', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('BACKEND_INTERNAL_KEY', '');
    mocks.headerValues.set('x-vercel-forwarded-for', '203.0.113.7');

    await fetchOffers();

    expect(sentRequest().headers.get('X-Client-IP')).toBeNull();
  });

  it('does not break a read made outside a request scope', async () => {
    vi.stubEnv('VERCEL', '1');
    const { headers } = await import('next/headers');
    vi.mocked(headers).mockRejectedValueOnce(new Error('outside a request scope'));

    await expect(fetchOffers()).resolves.toMatchObject({ total: 0 });

    expect(sentRequest().headers.get('X-Client-IP')).toBeNull();
  });
});
