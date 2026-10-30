import { describe, expect, it } from 'vitest';
import {
  auditLogsHref,
  auditLogsRangeText,
  auditNoticeId,
  auditNoticeItemId,
  entryCount,
  hasAuditLogFilters,
  isCanonicalAuditLogsUrl,
  maxAuditLogPage,
  parseAuditLogsQuery,
  toAuditLogListParams,
} from '@/app/(admin)/admin/audit-logs/audit-logs-query';

const parse = (raw: Record<string, string | string[] | undefined>) => parseAuditLogsQuery(raw);

describe('parseAuditLogsQuery', () => {
  it('uses the defaults and no notices for an empty URL', () => {
    const { query, notices } = parse({});

    expect(query).toEqual({
      action: undefined,
      user: undefined,
      org: undefined,
      from: undefined,
      to: undefined,
      size: 50,
      page: 1,
    });
    expect(notices).toEqual([]);
    expect(hasAuditLogFilters(query)).toBe(false);
  });

  it('accepts every valid filter and trims text', () => {
    const { query, notices } = parse({
      action: ' admin.offers.update ',
      user: 'user_1-A',
      org: 'org-9',
      from: '2026-01-31',
      to: '2026-02-01',
      size: '25',
      page: '3',
    });

    expect(query).toEqual({
      action: 'admin.offers.update',
      user: 'user_1-A',
      org: 'org-9',
      from: '2026-01-31',
      to: '2026-02-01',
      size: 25,
      page: 3,
    });
    expect(notices).toEqual([]);
    expect(hasAuditLogFilters(query)).toBe(true);
  });

  it('treats blank values as not set, without a notice', () => {
    const { query, notices } = parse({ action: '', user: '   ', from: '' });

    expect(query.action).toBeUndefined();
    expect(query.user).toBeUndefined();
    expect(notices).toEqual([]);
  });

  it.each([
    ['action', 'Admin.Offers', 'action filter'],
    ['action', 'noperiod', 'action filter'],
    ['action', 'a.b; DROP TABLE x', 'action filter'],
    ['action', `a.${'b'.repeat(120)}`, 'action filter'],
    ['user', 'not valid!', 'user ID filter'],
    ['user', '../../etc/passwd', 'user ID filter'],
    ['user', 'x'.repeat(129), 'user ID filter'],
    ['org', 'a b', 'organisation ID filter'],
    ['org', '<script>', 'organisation ID filter'],
    ['from', '2026-02-30', '"From" date'],
    ['from', '2026-13-01', '"From" date'],
    ['from', '01/02/2026', '"From" date'],
    ['from', '2026-01-01T00:00:00Z', '"From" date'],
    ['from', '0000-01-01', '"From" date'],
    ['to', '0000-12-31', '"To" date'],
    ['to', 'tomorrow', '"To" date'],
  ])('drops an invalid %s (%s) with a curated notice that never echoes it', (key, value, text) => {
    const { query, notices } = parse({ [key]: value });

    expect(query[key as 'action']).toBeUndefined();
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain(text);
    expect(notices[0]).not.toContain(value);
  });

  it('drops a repeated parameter (an array) instead of picking one', () => {
    const { query, notices } = parse({ action: ['admin.offers.update', 'admin.users.ban'] });

    expect(query.action).toBeUndefined();
    expect(notices).toHaveLength(1);
  });

  it('drops both dates when To is before From', () => {
    const { query, notices } = parse({ from: '2026-03-02', to: '2026-03-01' });

    expect(query.from).toBeUndefined();
    expect(query.to).toBeUndefined();
    expect(notices).toEqual(['Both dates were ignored because "To" is before "From".']);
  });

  it('keeps year 1, the earliest date the API can hold', () => {
    expect(parse({ from: '0001-01-01' }).query.from).toBe('0001-01-01');
  });

  it('reports no invalid fields for a clean query', () => {
    expect(parse({ action: 'admin.users.ban', from: '2026-01-01' }).invalid.size).toBe(0);
  });

  it('reports each rejected field, and both dates for an inverted range', () => {
    expect(
      [...parse({ action: 'x', user: '!', org: 'a b', from: 'no', to: 'no' }).invalid].sort()
    ).toEqual(['action', 'from', 'org', 'to', 'user']);
    expect([...parse({ from: '2026-03-02', to: '2026-03-01' }).invalid].sort()).toEqual([
      'from',
      'to',
    ]);
  });

  it('keeps a one-day range', () => {
    const { query } = parse({ from: '2026-03-01', to: '2026-03-01' });

    expect(query.from).toBe('2026-03-01');
    expect(query.to).toBe('2026-03-01');
  });

  it('keeps a leap day and drops a non-leap one', () => {
    expect(parse({ from: '2028-02-29' }).query.from).toBe('2028-02-29');
    expect(parse({ from: '2027-02-29' }).query.from).toBeUndefined();
  });

  it.each([
    ['10'],
    ['0'],
    ['101'],
    ['-1'],
    ['abc'],
    ['50.5'],
    ['1e2'],
    ['050'],
    [' 50'],
    [['25', '50']],
  ])('falls back to the default page size for size %j', (size) => {
    const { query, notices } = parse({ size: size as string });

    expect(query.size).toBe(50);
    expect(notices).toEqual([]);
  });

  it.each([[25], [50], [100]])('accepts the page size %i', (size) => {
    expect(parse({ size: String(size) }).query.size).toBe(size);
  });

  it.each([['0'], ['-3'], ['abc'], ['1.5'], ['1e3'], ['0x10'], ['9999999'], [['2', '3']]])(
    'falls back to page 1 for page %j',
    (page) => {
      const { query } = parse({ page: page as string });

      expect(query.page).toBe(1);
    }
  );

  it('clamps a page past the API offset cap to the last reachable page', () => {
    expect(parse({ page: '500', size: '100' }).query.page).toBe(101);
    expect(parse({ page: '500', size: '25' }).query.page).toBe(401);
    expect(parse({ page: '500' }).query.page).toBe(201);
  });

  it('ignores unknown parameters', () => {
    const { query, notices } = parse({ q: 'x', offset: '9999', limit: '1000', admin: 'true' });

    expect(query).toEqual(parse({}).query);
    expect(notices).toEqual([]);
  });
});

describe('maxAuditLogPage', () => {
  it('is the last page whose offset stays within 10,000', () => {
    for (const size of [25, 50, 100] as const) {
      expect((maxAuditLogPage(size) - 1) * size).toBeLessThanOrEqual(10_000);
      expect(maxAuditLogPage(size) * size).toBeGreaterThan(10_000);
    }
  });
});

describe('toAuditLogListParams', () => {
  it('turns dates into whole UTC days and the page into an offset', () => {
    const { query } = parse({
      action: 'admin.users.ban',
      user: 'u1',
      org: 'o1',
      from: '2026-01-05',
      to: '2026-01-06',
      size: '25',
      page: '4',
    });

    expect(toAuditLogListParams(query)).toEqual({
      action: 'admin.users.ban',
      userId: 'u1',
      organizationId: 'o1',
      createdFrom: '2026-01-05T00:00:00Z',
      createdTo: '2026-01-06T23:59:59.999999Z',
      limit: 25,
      offset: 75,
    });
  });

  it('leaves unset filters undefined and starts at offset 0', () => {
    const params = toAuditLogListParams(parse({}).query);

    expect(params).toEqual({
      action: undefined,
      userId: undefined,
      organizationId: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it('never exceeds the API offset cap', () => {
    for (const size of ['25', '50', '100']) {
      const params = toAuditLogListParams(parse({ page: '99999', size }).query);
      expect(params.offset).toBeLessThanOrEqual(10_000);
    }
  });
});

describe('auditLogsHref', () => {
  it('is the bare path with no filters and default paging', () => {
    expect(auditLogsHref({})).toBe('/admin/audit-logs');
    expect(auditLogsHref(parse({}).query)).toBe('/admin/audit-logs');
  });

  it('carries every filter and leaves the defaults out', () => {
    const { query } = parse({
      action: 'admin.offers.create',
      user: 'u1',
      org: 'o1',
      from: '2026-01-01',
      to: '2026-01-31',
      size: '100',
      page: '2',
    });

    expect(auditLogsHref(query)).toBe(
      '/admin/audit-logs?action=admin.offers.create&user=u1&org=o1&from=2026-01-01&to=2026-01-31&size=100&page=2'
    );
    expect(auditLogsHref({ ...query, size: 50, page: 1 })).not.toMatch(/size=|page=/);
  });

  it('round-trips through the parser', () => {
    const { query } = parse({ action: 'a.b', from: '2026-01-01', size: '25', page: '7' });

    const url = new URL(auditLogsHref(query), 'http://localhost');
    const raw = Object.fromEntries(url.searchParams);

    expect(parse(raw).query).toEqual(query);
  });
});

describe('auditNoticeId', () => {
  it('points a rejected field at its own notice, and an inverted range at the range notice', () => {
    const bad = parse({ action: 'Bad Value' });
    expect(auditNoticeId('action', bad)).toBe('audit-notice-action');
    expect(auditNoticeId('user', bad)).toBeUndefined();

    const range = parse({ from: '2026-03-02', to: '2026-03-01' });
    expect(auditNoticeId('from', range)).toBe('audit-notice-range');
    expect(auditNoticeId('to', range)).toBe('audit-notice-range');
  });

  it('gives every notice a list item id matching its field', () => {
    const { notices } = parse({ action: 'x', org: '!', from: '2026-03-02', to: '2026-03-01' });

    expect(notices.map(auditNoticeItemId)).toEqual([
      'audit-notice-action',
      'audit-notice-org',
      'audit-notice-range',
    ]);
    expect(auditNoticeItemId('something else')).toBe('audit-notice-other');
  });
});

describe('entryCount', () => {
  it('uses the singular only for exactly one', () => {
    expect(entryCount(0)).toBe('0 entries');
    expect(entryCount(1)).toBe('1 entry');
    expect(entryCount(2)).toBe('2 entries');
  });
});

describe('isCanonicalAuditLogsUrl', () => {
  const canonical = (raw: Record<string, string | string[] | undefined>) =>
    isCanonicalAuditLogsUrl(raw, parse(raw).query);

  it('accepts the bare URL and a tidy one', () => {
    expect(canonical({})).toBe(true);
    expect(canonical({ action: 'admin.users.ban', size: '25', page: '2' })).toBe(true);
  });

  it.each([
    ['a blank field', { user: '' }],
    ['the default size', { size: '50' }],
    ['page 1', { page: '1' }],
    ['an unknown parameter', { utm: 'x' }],
    ['untrimmed text', { action: ' admin.users.ban ' }],
    ['a repeated parameter', { action: ['a.b', 'c.d'] }],
    ['a clamped page', { page: '9999' }],
  ])('rejects %s', (_name, raw) => {
    expect(canonical(raw)).toBe(false);
  });
});

describe('auditLogsRangeText', () => {
  it('names the first and last entry on the page', () => {
    const { query } = parse({ page: '3', size: '25' });

    expect(auditLogsRangeText(query, 25, 120)).toBe('Showing 51 to 75 of 120 entries');
    expect(auditLogsRangeText({ ...query, page: 1 }, 1, 1)).toBe('Showing 1 to 1 of 1 entry');
  });
});
