// @vitest-environment node
/** GET /go/[offerId]: where it redirects, what it ignores, and what it never does. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/outbound', () => ({ recordOutboundClick: vi.fn() }));

import { GET, HEAD } from '@/app/go/[offerId]/route';
import { recordOutboundClick, type OutboundClickResult } from '@/lib/api/outbound';
import { logger } from '@/lib/logger';

const recordMock = vi.mocked(recordOutboundClick);
const DESTINATION = 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2';

function call(path = '/go/offer_1', headers: Record<string, string> = {}, offerId = 'offer_1') {
  const request = new NextRequest(`http://localhost:3000${path}`, { headers });
  return GET(request, { params: Promise.resolve({ offerId }) });
}

function backendAnswers(result: OutboundClickResult) {
  recordMock.mockResolvedValue(result);
}

describe('GET /go/[offerId]', () => {
  beforeEach(() => {
    recordMock.mockReset();
    vi.clearAllMocks();
  });

  it('redirects with a 307 to the stored destination, uncached, with the referrer policy', async () => {
    backendAnswers({ kind: 'redirect', destination: DESTINATION });

    const response = await call();

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe(DESTINATION);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sets no cookie on any outcome', async () => {
    const outcomes: OutboundClickResult[] = [
      { kind: 'redirect', destination: DESTINATION },
      { kind: 'ended', slug: 'free-shampoo' },
      { kind: 'not_found' },
      { kind: 'rate_limited' },
      { kind: 'unavailable' },
    ];
    for (const outcome of outcomes) {
      backendAnswers(outcome);
      const response = await call('/go/offer_1', { cookie: 'session=abc; visitor=1' });
      expect(response.headers.get('Set-Cookie')).toBeNull();
      expect(response.cookies.getAll()).toEqual([]);
    }
  });

  it('sends the backend only the path id, the referrer host and a device class', async () => {
    backendAnswers({ kind: 'redirect', destination: DESTINATION });

    await call('/go/offer_1', {
      referer: 'https://News.Example/a/b?token=secret',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148',
      cookie: 'visitor=cookie-id-4242',
      'x-forwarded-for': '203.0.113.7',
      'x-client-ip': '203.0.113.8',
    });

    expect(recordMock).toHaveBeenCalledOnce();
    expect(recordMock).toHaveBeenCalledWith('offer_1', {
      referrerHost: 'news.example',
      userAgentClass: 'MOBILE',
    });
  });

  it.each([
    '?url=https://evil.example',
    '?to=//evil.example',
    '?redirect=//evil.example&next=javascript:alert(1)',
    '?destination=https%3A%2F%2Fevil.example',
    '?offerId=other&id=other',
    '?ended=1',
    '?x=%0d%0aLocation:%20https://evil.example',
  ])('ignores the query string %s', async (query) => {
    backendAnswers({ kind: 'redirect', destination: DESTINATION });

    const response = await call(`/go/offer_1${query}`);

    expect(response.headers.get('Location')).toBe(DESTINATION);
    expect(recordMock).toHaveBeenCalledWith('offer_1', expect.any(Object));
    expect(JSON.stringify(recordMock.mock.calls)).not.toContain('evil');
  });

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['http', 'http://www.awin1.com/x'],
    ['protocol relative', '//evil.example/x'],
    ['userinfo', 'https://good.example@evil.example/'],
    ['backslash', 'https://evil.example\\@good.example/'],
    ['CRLF', 'https://www.awin1.com/x\r\nSet-Cookie: a=b'],
    ['scheme without slashes', 'https:evil.example'],
    ['custom port', 'https://www.awin1.com:8443/'],
    ['empty', ''],
  ])('never redirects to a %s destination even if the backend returned one', async (_n, value) => {
    backendAnswers({ kind: 'redirect', destination: value });

    const response = await call();

    expect(response.status).toBe(503);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(logger.error).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('evil');
  });

  it('sends an ended offer to its page with ?ended=1 and drops every other query parameter', async () => {
    backendAnswers({ kind: 'ended', slug: 'free-shampoo' });

    const response = await call('/go/offer_1?url=//evil.example&utm=x');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      'http://localhost:3000/freebies/free-shampoo?ended=1'
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['../admin', 'a/b', 'Free Shampoo', '//evil.example', 'x?y=1', ''])(
    'answers 404, not a redirect, when the ended slug is %j',
    async (slug) => {
      backendAnswers({ kind: 'ended', slug });

      const response = await call();

      expect(response.status).toBe(404);
      expect(response.headers.get('Location')).toBeNull();
    }
  );

  it('answers an unknown or unpublished offer with an uncached 404', async () => {
    backendAnswers({ kind: 'not_found' });

    const response = await call();

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Location')).toBeNull();
  });

  it('passes a rate limit on as 429 with Retry-After', async () => {
    backendAnswers({ kind: 'rate_limited' });

    const response = await call();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('answers 503 when the backend is unavailable, with no backend text', async () => {
    backendAnswers({ kind: 'unavailable' });

    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/backend|error|stack/i);
    expect(response.headers.get('Location')).toBeNull();
  });

  it.each(['a b', '..', 'a.b', 'a;b', '%2e%2e', 'x'.repeat(65), '//evil.example', ''])(
    'answers 404 without calling the backend for the malformed id %j',
    async (offerId) => {
      const response = await call('/go/x', {}, offerId);

      expect(response.status).toBe(404);
      expect(recordMock).not.toHaveBeenCalled();
    }
  );

  it.each<Record<string, string>>([
    { 'sec-purpose': 'prefetch' },
    { purpose: 'prefetch' },
    { 'sec-purpose': 'prefetch;prerender' },
  ])('does not count a speculative load (%j)', async (headers) => {
    const response = await call('/go/offer_1', headers);

    expect(response.status).toBe(204);
    expect(response.headers.get('Location')).toBeNull();
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('answers HEAD with 405 and never records a click', () => {
    const response = HEAD();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(recordMock).not.toHaveBeenCalled();
  });
});
