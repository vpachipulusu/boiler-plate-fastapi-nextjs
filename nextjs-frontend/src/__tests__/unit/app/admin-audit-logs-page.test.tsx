/**
 * The admin audit log page: the admin gate runs before anything else, the URL is validated before it reaches the
 * API wrapper (and tidied by a redirect when it is clean but untidy), the filters and paging links carry each
 * other, and every failure is a curated message.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  fetchAdminAuditLogs: vi.fn(),
  requireAdminPage: vi.fn(),
  logError: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@/app/(admin)/admin/_lib/require-admin-page', () => ({
  requireAdminPage: mocks.requireAdminPage,
}));
vi.mock('@/lib/api/admin-audit-logs', () => ({
  AUDIT_LOG_PAGE_SIZE: 50,
  fetchAdminAuditLogs: mocks.fetchAdminAuditLogs,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.logError } }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import type { AuditLogEntry } from '@/lib/api/generated';
import AdminAuditLogsPage from '@/app/(admin)/admin/audit-logs/page';

const ENTRY = {
  id: 'a1',
  created_at: '2026-01-01T00:00:00Z',
  user_id: 'user-1',
  organization_id: null,
  action: 'admin.users.ban',
  resource: 'users',
  resource_id: null,
  metadata: null,
  ip_address: '203.0.113.9',
  user_agent: null,
} satisfies AuditLogEntry;

const auditPage = (entries: AuditLogEntry[], total = entries.length, offset = 0) => ({
  success: true,
  data: { entries, total_count: total, limit: 50, offset },
});

type Raw = Record<string, string | string[] | undefined>;
async function renderPage(raw: Raw = {}) {
  render(await AdminAuditLogsPage({ searchParams: Promise.resolve(raw) }));
}

const linkHref = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

describe('admin audit logs page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPage.mockResolvedValue(undefined);
    mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([ENTRY], 250));
  });

  describe('admin gate', () => {
    it('runs before the search params are awaited and before any fetch', async () => {
      const order: string[] = [];
      mocks.requireAdminPage.mockImplementation(async () => {
        order.push('gate');
      });
      mocks.fetchAdminAuditLogs.mockImplementation(async () => {
        order.push('fetch');
        return auditPage([]);
      });
      const searchParams = {
        then(resolve: (value: Raw) => void) {
          order.push('params');
          resolve({});
        },
      } as unknown as Promise<Raw>;

      await AdminAuditLogsPage({ searchParams });

      expect(order).toEqual(['gate', 'params', 'fetch']);
    });

    it('does not read the params, redirect or call the API when the gate refuses', async () => {
      mocks.requireAdminPage.mockRejectedValue(new Error('NEXT_REDIRECT'));
      const params = vi.fn();
      const searchParams = { then: params } as unknown as Promise<Raw>;

      await expect(AdminAuditLogsPage({ searchParams })).rejects.toThrow('NEXT_REDIRECT');

      expect(params).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.fetchAdminAuditLogs).not.toHaveBeenCalled();
    });
  });

  describe('tidy URLs', () => {
    it('redirects a clean query with blank fields and the default size to its canonical link, before any fetch', async () => {
      await expect(
        renderPage({ action: 'admin.users.ban', user: '', org: '', from: '', to: '', size: '50' })
      ).rejects.toThrow('REDIRECT:/admin/audit-logs?action=admin.users.ban');

      expect(mocks.redirect).toHaveBeenCalledWith('/admin/audit-logs?action=admin.users.ban');
      expect(mocks.fetchAdminAuditLogs).not.toHaveBeenCalled();
    });

    it.each([
      ['a default page', { page: '1' }, '/admin/audit-logs'],
      ['an unknown parameter', { utm: 'x' }, '/admin/audit-logs'],
      [
        'untrimmed text',
        { action: ' admin.users.ban ' },
        '/admin/audit-logs?action=admin.users.ban',
      ],
      ['a page past the cap', { page: '500', size: '100' }, '/admin/audit-logs?size=100&page=101'],
    ])('redirects %s', async (_name, raw, target) => {
      await expect(renderPage(raw)).rejects.toThrow(`REDIRECT:${target}`);
    });

    it('does not redirect a query that is already canonical', async () => {
      await renderPage({ action: 'admin.users.ban', size: '25', page: '2' });

      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.fetchAdminAuditLogs).toHaveBeenCalledTimes(1);
    });

    it('does not redirect when there are notices, so the admin still sees what was ignored', async () => {
      await renderPage({ action: 'Bad Value', user: '' });

      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(screen.getByText(/The action filter was ignored/)).toBeInTheDocument();
    });

    it('only ever redirects to the audit log path with validated values', async () => {
      await expect(renderPage({ action: 'admin.users.ban', page: '0' })).rejects.toThrow(
        'REDIRECT'
      );

      const [url] = mocks.redirect.mock.calls[0];
      expect(url).toMatch(/^\/admin\/audit-logs(\?[a-z0-9._=&-]+)?$/);
    });
  });

  describe('API call', () => {
    it('asks for the newest 50 with no filters by default', async () => {
      await renderPage();

      expect(mocks.fetchAdminAuditLogs).toHaveBeenCalledWith({
        action: undefined,
        userId: undefined,
        organizationId: undefined,
        createdFrom: undefined,
        createdTo: undefined,
        limit: 50,
        offset: 0,
      });
    });

    it('passes validated filters, whole UTC days, the page size and the offset', async () => {
      await renderPage({
        action: 'admin.offers.update',
        user: 'u1',
        org: 'o-2',
        from: '2026-01-05',
        to: '2026-01-06',
        size: '25',
        page: '3',
      });

      expect(mocks.fetchAdminAuditLogs).toHaveBeenCalledWith({
        action: 'admin.offers.update',
        userId: 'u1',
        organizationId: 'o-2',
        createdFrom: '2026-01-05T00:00:00Z',
        createdTo: '2026-01-06T23:59:59.999999Z',
        limit: 25,
        offset: 50,
      });
    });

    it('never passes junk or unknown parameters on', async () => {
      await renderPage({
        action: 'x; DROP TABLE',
        user: '../../admin',
        from: 'yesterday',
        size: '100000',
        page: '-4',
        limit: '5000',
        offset: '99999',
      });

      expect(mocks.fetchAdminAuditLogs).toHaveBeenCalledTimes(1);
      expect(mocks.fetchAdminAuditLogs).toHaveBeenCalledWith({
        action: undefined,
        userId: undefined,
        organizationId: undefined,
        createdFrom: undefined,
        createdTo: undefined,
        limit: 50,
        offset: 0,
      });
    });

    it('tells the admin which filters were ignored, without echoing the values', async () => {
      await renderPage({ action: 'x; DROP TABLE', user: '<b>boom</b>' });

      expect(screen.getByText(/The action filter was ignored/)).toBeInTheDocument();
      expect(screen.getByText(/The user ID filter was ignored/)).toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain('DROP TABLE');
      expect(document.body.innerHTML).not.toContain('boom');
    });
  });

  describe('results', () => {
    it('renders entries through a labelled table with the range and total', async () => {
      await renderPage();

      const table = screen.getByRole('table', { name: 'Audit log entries' });
      expect(within(table).getByText('admin.users.ban')).toBeInTheDocument();
      expect(within(table).getByText('user-1')).toBeInTheDocument();
      expect(within(table).getByText('203.0.113.9')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 1 of 250 entries (newest first)')).toBeInTheDocument();
    });

    it('puts the count line in a status region, so a change to it can be announced', async () => {
      await renderPage({ page: '2' });

      const status = screen.getByText(/Showing 51 to 51 of 250 entries/);
      expect(status).toHaveAttribute('role', 'status');
    });

    it('uses the singular for a single entry', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([ENTRY], 1));

      await renderPage();

      expect(screen.getByText('Showing 1 to 1 of 1 entry (newest first)')).toBeInTheDocument();
    });

    it('titles the results with a focusable h2 and the filters with an h2 too', async () => {
      await renderPage();

      expect(screen.getByRole('heading', { level: 1, name: 'Audit Logs' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Filters' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Recent Activity' })).toHaveAttribute(
        'tabindex',
        '-1'
      );
    });

    it('labels timestamps as UTC and leaves an unparsable one empty', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(
        auditPage([
          { ...ENTRY, id: 'a', created_at: '2026-01-05T14:03:00Z' },
          { ...ENTRY, id: 'b', created_at: 'garbage' },
        ])
      );

      await renderPage();

      expect(screen.getByText('5 Jan 2026, 14:03 UTC')).toBeInTheDocument();
      expect(document.body.textContent).not.toContain('Invalid Date');
    });

    it('gives screen readers text for missing user and IP values', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(
        auditPage([{ ...ENTRY, user_id: null, ip_address: null }])
      );

      await renderPage();

      expect(screen.getAllByText('None')).toHaveLength(2);
    });

    it('renders a stacked table with a labelled cell per column', async () => {
      await renderPage();

      const cells = screen.getAllByRole('cell');
      expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([
        'Timestamp',
        'Action',
        'Resource',
        'User ID',
        'IP Address',
      ]);
    });
  });

  describe('paging', () => {
    it('shows no pager when everything fits on one page', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([ENTRY], 1));

      await renderPage();

      expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
    });

    it('offers only Next on the first page, with a page indicator', async () => {
      await renderPage();

      const pager = screen.getByRole('navigation', { name: 'Pagination' });
      expect(within(pager).getByText('Page 1 of 5')).toBeInTheDocument();
      expect(within(pager).queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
      expect(linkHref('Next')).toBe('/admin/audit-logs?page=2');
    });

    it('keeps every filter and the page size in the Previous and Next links', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([ENTRY], 250, 50));

      await renderPage({
        action: 'admin.users.ban',
        user: 'u1',
        org: 'o1',
        from: '2026-01-01',
        to: '2026-01-31',
        size: '25',
        page: '2',
      });

      const base = 'action=admin.users.ban&user=u1&org=o1&from=2026-01-01&to=2026-01-31&size=25';
      expect(linkHref('Previous')).toBe(`/admin/audit-logs?${base}`);
      expect(linkHref('Next')).toBe(`/admin/audit-logs?${base}&page=3`);
      expect(screen.getByText('Page 2 of 10')).toBeInTheDocument();
    });

    it('offers only Previous on the last page', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([ENTRY], 250, 200));

      await renderPage({ page: '5' });

      expect(linkHref('Previous')).toBe('/admin/audit-logs?page=4');
      expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
    });

    it('explains the offset cap instead of linking past it', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([ENTRY], 50_000, 10_000));

      await renderPage({ page: '101', size: '100' });

      expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.getByText('Page 101 of 101+')).toBeInTheDocument();
      expect(screen.getByText(/Narrow the filters or the date range/)).toBeInTheDocument();
    });
  });

  describe('empty and error states', () => {
    it('shows the plain empty state when there is nothing and no filter', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([]));

      await renderPage();

      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows "No entries match these filters" with a Reset link when a filter matches nothing', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([]));

      await renderPage({ action: 'admin.users.ban' });

      expect(screen.getByText('No entries match these filters')).toBeInTheDocument();
      const reset = screen.getAllByRole('link', { name: 'Reset filters' });
      expect(reset).toHaveLength(2);
      for (const link of reset) expect(link).toHaveAttribute('href', '/admin/audit-logs');
    });

    it('says "No entries match these filters" for a filtered empty result even on a later page with no total', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([], 0, 400));

      await renderPage({ action: 'admin.users.ban', page: '9' });

      expect(screen.getByText('No entries match these filters')).toBeInTheDocument();
      expect(screen.queryByText('No entries on this page')).not.toBeInTheDocument();
    });

    it('points an empty page past the data back to the first page, keeping the filters', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([], 30, 400));

      await renderPage({ action: 'admin.users.ban', page: '9' });

      expect(screen.getByText('No entries on this page')).toBeInTheDocument();
      expect(linkHref('Back to first page')).toBe('/admin/audit-logs?action=admin.users.ban');
    });

    it('keeps the page size when sending an empty later page back to the first', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue(auditPage([], 10, 50));

      await renderPage({ page: '2', size: '25' });

      expect(linkHref('Back to first page')).toBe('/admin/audit-logs?size=25');
    });

    it('shows an inline error whose Retry link keeps the filters', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue({ success: false, error: 'SECRET', status: 500 });

      await renderPage({ action: 'admin.users.ban', page: '2' });

      const alert = screen.getByRole('alert');
      expect(within(alert).getByRole('link', { name: 'Retry' })).toHaveAttribute(
        'href',
        '/admin/audit-logs?action=admin.users.ban&page=2'
      );
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it.each([
      [403, 'You do not have permission to do that'],
      [404, 'Not found'],
      [500, 'Something went wrong'],
      [undefined, 'The admin service is unavailable'],
    ])('shows a curated message for status %s and no backend text', async (status, text) => {
      mocks.fetchAdminAuditLogs.mockResolvedValue({ success: false, error: 'SECRET', status });

      await renderPage({ action: 'admin.users.ban' });

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(document.body.textContent).not.toContain('SECRET');
    });

    it('logs the status only, never the filters or any user data', async () => {
      mocks.fetchAdminAuditLogs.mockResolvedValue({ success: false, error: 'SECRET', status: 500 });

      await renderPage({ action: 'admin.users.ban', user: 'user-1' });

      expect(mocks.logError).toHaveBeenCalledWith('Admin audit logs page: list failed', {
        status: 500,
      });
    });
  });

  describe('filters on the page', () => {
    it('keeps the submitted filters in the form so the URL and the form agree', async () => {
      await renderPage({ action: 'admin.users.ban', from: '2026-01-05', size: '100' });

      expect(screen.getByLabelText('Action')).toHaveValue('admin.users.ban');
      expect(screen.getByLabelText('From date')).toHaveValue('2026-01-05');
      expect(screen.getByLabelText('Entries per page')).toHaveValue('100');
    });

    it('marks a rejected filter invalid and describes it with its notice', async () => {
      await renderPage({ action: 'Bad Value' });

      const action = screen.getByLabelText('Action');
      expect(action).toHaveAttribute('aria-invalid', 'true');
      expect(action).toHaveValue('');
      expect(action).toHaveAccessibleDescription(/The action filter was ignored/);
    });
  });
});
