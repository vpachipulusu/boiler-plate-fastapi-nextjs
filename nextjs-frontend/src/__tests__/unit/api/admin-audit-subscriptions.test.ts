// @vitest-environment node
/**
 * the admin audit log and subscription wrappers call the /v1/admin routes with the session cookie
 * and the internal key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
  headers: vi.fn(async () => ({ get: vi.fn() })),
}));

import { AUDIT_LOG_PAGE_SIZE, fetchAdminAuditLogs } from '@/lib/api/admin-audit-logs';
import { fetchAdminSubscriptions } from '@/lib/api/admin-subscriptions';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('admin audit log and subscription wrappers', () => {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

  beforeEach(() => {
    vi.stubEnv('BACKEND_API_URL', 'http://backend.test');
    vi.stubEnv('BACKEND_INTERNAL_KEY', 'server-key');
    cookieGet.mockReturnValue({ name: 'session', value: 'firebase-session-cookie' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    cookieGet.mockReset();
  });

  it('fetchAdminAuditLogs asks for the latest page with the session headers', async () => {
    const data = { entries: [], total_count: 0, limit: AUDIT_LOG_PAGE_SIZE, offset: 0 };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data }));

    const result = await fetchAdminAuditLogs();

    expect(result).toEqual({ success: true, data });
    const request = fetchMock.mock.calls[0][0];
    const url = new URL(request.url);
    expect(url.pathname).toBe('/v1/admin/audit-logs');
    expect(url.searchParams.get('limit')).toBe(String(AUDIT_LOG_PAGE_SIZE));
    expect(url.searchParams.get('offset')).toBe('0');
    expect([...url.searchParams.keys()].sort()).toEqual(['limit', 'offset']);
    expect(request.headers.get('X-Session-Token')).toBe('firebase-session-cookie');
    expect(request.headers.get('X-Internal-Key')).toBe('server-key');
  });

  it('fetchAdminAuditLogs sends every filter and the paging as query parameters', async () => {
    const data = { entries: [], total_count: 0, limit: 25, offset: 50 };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data }));

    await fetchAdminAuditLogs({
      action: 'admin.users.ban',
      userId: 'u1',
      organizationId: 'o1',
      createdFrom: '2026-01-05T00:00:00Z',
      createdTo: '2026-01-06T23:59:59.999999Z',
      limit: 25,
      offset: 50,
    });

    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.pathname).toBe('/v1/admin/audit-logs');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'admin.users.ban',
      user_id: 'u1',
      organization_id: 'o1',
      created_from: '2026-01-05T00:00:00Z',
      created_to: '2026-01-06T23:59:59.999999Z',
      limit: '25',
      offset: '50',
    });
  });

  it('fetchAdminSubscriptions passes the status and plan filters and paging', async () => {
    const data = { subscriptions: [], total_count: 0, limit: 20, offset: 0 };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data }));

    await fetchAdminSubscriptions({ status: 'active', plan: 'pro', limit: 20 });

    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.pathname).toBe('/v1/admin/subscriptions');
    expect(url.searchParams.get('status')).toBe('active');
    expect(url.searchParams.get('plan')).toBe('pro');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('fetchAdminSubscriptions omits unset filters', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { subscriptions: [], total_count: 0, limit: 1, offset: 0 },
      })
    );

    await fetchAdminSubscriptions({});

    const params = new URL(fetchMock.mock.calls[0][0].url).searchParams;
    expect(params.has('status')).toBe(false);
    expect(params.has('plan')).toBe(false);
  });

  it('returns a failed result without throwing when the backend rejects', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, error: 'SECRET' }, 403));

    const result = await fetchAdminAuditLogs();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(403);
  });
});
