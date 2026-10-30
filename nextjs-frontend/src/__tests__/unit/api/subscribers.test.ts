// @vitest-environment node
/** the subscriber wrappers call the sign-up routes with the internal key, no session and a JSON body. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
  headers: vi.fn(async () => ({ get: vi.fn() })),
}));

import {
  confirmAlertsSubscription,
  startAlertsSubscription,
  unsubscribeFromAlertEmails,
} from '@/lib/api/subscribers';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('subscriber wrappers', () => {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

  beforeEach(() => {
    vi.stubEnv('BACKEND_API_URL', 'http://backend.test');
    vi.stubEnv('BACKEND_INTERNAL_KEY', 'server-key');
    cookieGet.mockReturnValue({ name: 'session', value: 'should-not-be-sent' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('posts a sign-up with consent flags added and no session cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { status: 'accepted' } }, 202));

    const result = await startAlertsSubscription({
      email: 'sam@example.com',
      categories: ['beauty'],
      frequency: 'DAILY',
      consent_text: 'wording',
    });

    const request = fetchMock.mock.calls[0][0];
    expect(result).toEqual({ success: true, data: { status: 'accepted' } });
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/v1/subscribers');
    expect(request.headers.get('X-Internal-Key')).toBe('server-key');
    expect(request.headers.get('X-Session-Token')).toBeNull();
    expect(await request.json()).toEqual({
      email: 'sam@example.com',
      categories: ['beauty'],
      frequency: 'DAILY',
      consent_text: 'wording',
      consent: true,
      consent_source: 'alerts_page',
    });
  });

  it.each([
    ['confirm', confirmAlertsSubscription, '/v1/subscribers/confirm'],
    ['unsubscribe', unsubscribeFromAlertEmails, '/v1/subscribers/unsubscribe'],
  ] as const)('posts the %s token in the body, never in the address', async (_name, call, path) => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }));

    await call('tok.en');

    const request = fetchMock.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe(path);
    expect(new URL(request.url).search).toBe('');
    expect(await request.json()).toEqual({ token: 'tok.en' });
  });

  it('returns the status of a failed call', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: 'Invalid or expired link' }, 400)
    );

    expect(await confirmAlertsSubscription('bad')).toEqual({
      success: false,
      error: 'Invalid or expired link',
      status: 400,
    });
  });

  it('refuses to run without the internal key', async () => {
    vi.stubEnv('BACKEND_INTERNAL_KEY', '');

    await expect(confirmAlertsSubscription('tok')).rejects.toThrow('BACKEND_INTERNAL_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
