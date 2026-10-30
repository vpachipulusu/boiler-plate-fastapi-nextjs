// @vitest-environment node
/**
 * The admin offers list: URL parameters, the stats strip (counts come only from the API), the status chips,
 * the filters, and the table with its status pills and verified dates.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  fetchAdminOffers: vi.fn(),
  fetchOfferStatusCounts: vi.fn(),
  fetchAdminCategories: vi.fn(),
  fetchAdminMerchants: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/api/admin-offers', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/admin-offers')>('@/lib/api/admin-offers');
  return {
    ...actual,
    fetchAdminOffers: mocks.fetchAdminOffers,
    fetchOfferStatusCounts: mocks.fetchOfferStatusCounts,
  };
});
vi.mock('@/lib/api/admin-categories', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/admin-categories')>(
    '@/lib/api/admin-categories'
  );
  return { ...actual, fetchAdminCategories: mocks.fetchAdminCategories };
});
vi.mock('@/lib/api/admin-merchants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/admin-merchants')>(
    '@/lib/api/admin-merchants'
  );
  return { ...actual, fetchAdminMerchants: mocks.fetchAdminMerchants };
});
vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  // `cache` memoises per request in Next; in a unit test each call must hit the mocks again.
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock('@/app/(admin)/admin/offers/_components/offer-row-actions', () => ({
  OfferRowActions: ({ offerId, status }: { offerId: string; status: string }) => (
    <span data-row-actions={offerId} data-status={status} />
  ),
}));

import AdminOffersPage from '@/app/(admin)/admin/offers/page';
import { OffersResults } from '@/app/(admin)/admin/offers/offers-results';
import { OfferStatsStrip } from '@/app/(admin)/admin/offers/offers-stats';
import { offersHref, parseOffersQuery } from '@/app/(admin)/admin/offers/offers-query';

const html = (node: ReactNode) => renderToStaticMarkup(node as ReactElement);

const SECRET = 'SECRET postgres://user:pw@host/db';

const offer = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1',
  title: 'Free coffee sample',
  slug: 'free-coffee-sample',
  category_id: 'c1',
  merchant_id: 'm1',
  offer_type: 'FREE_SAMPLE',
  status: 'PUBLISHED',
  featured: false,
  end_at: null,
  last_verified_at: '2026-03-05T10:00:00Z',
  updated_at: '2026-03-06T10:00:00Z',
  ...overrides,
});

function listOk(offers: unknown[], total = offers.length) {
  mocks.fetchAdminOffers.mockResolvedValue({
    success: true,
    data: { offers, total_count: total, limit: 25, offset: 0 },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchAdminCategories.mockResolvedValue({
    success: true,
    data: {
      categories: [
        { id: 'c1', name: 'Food & drink', enabled: true },
        { id: 'c2', name: 'Beauty', enabled: false },
      ],
      total_count: 2,
      limit: 100,
      offset: 0,
    },
  });
  mocks.fetchAdminMerchants.mockResolvedValue({
    success: true,
    data: {
      merchants: [{ id: 'm1', name: 'Good Beans', active: true }],
      total_count: 1,
      limit: 100,
      offset: 0,
    },
  });
});

describe('offers URL parameters', () => {
  it('parses and bounds every parameter', () => {
    expect(
      parseOffersQuery({
        q: `  ${'x'.repeat(150)} `,
        status: 'Published',
        category: 'c_1',
        page: '3',
      })
    ).toEqual({ q: 'x'.repeat(100), status: 'PUBLISHED', category: 'c_1', page: 3 });
  });

  it('ignores unknown statuses, bad category ids and bad pages', () => {
    expect(parseOffersQuery({ q: '  ', status: 'deleted', category: '../x', page: '-2' })).toEqual({
      q: undefined,
      status: undefined,
      category: undefined,
      page: 1,
    });
    expect(parseOffersQuery({ page: 'abc' }).page).toBe(1);
  });

  it('builds links that keep the filters and drop defaults', () => {
    expect(offersHref({})).toBe('/admin/offers');
    expect(offersHref({ q: 'a b', status: 'DRAFT', category: 'c1', page: 2 })).toBe(
      '/admin/offers?q=a+b&status=draft&category=c1&page=2'
    );
    expect(offersHref({ page: 1 })).toBe('/admin/offers');
  });
});

describe('OfferStatsStrip', () => {
  it('shows the counts the API returned, as a labelled list', async () => {
    mocks.fetchOfferStatusCounts.mockResolvedValue({
      success: true,
      data: { TOTAL: 31, PUBLISHED: 17, DRAFT: 8, EXPIRED: 4, ARCHIVED: 2 },
    });
    const markup = html(await OfferStatsStrip());
    expect(markup).toContain('aria-label="Offer counts"');
    for (const [label, count] of [
      ['Total offers', '31'],
      ['Published', '17'],
      ['Drafts', '8'],
      ['Expired', '4'],
      ['Archived', '2'],
    ]) {
      expect(markup).toMatch(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${count}</dd>`));
    }
  });

  it('shows no numbers at all when a count cannot be read', async () => {
    mocks.fetchOfferStatusCounts.mockResolvedValue({
      success: false,
      error: SECRET,
      status: 500,
    });
    const markup = html(await OfferStatsStrip());
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('<dd');
    expect(markup).not.toContain('SECRET');
    expect(markup).toContain('href="/admin/offers"');
  });
});

describe('admin offers page shell', () => {
  it('has the heading, an add link, status chips and a labelled GET search', async () => {
    const markup = html(
      await AdminOffersPage({
        searchParams: Promise.resolve({ q: 'coffee', status: 'draft', category: 'c1' }),
      })
    );
    expect(markup).toContain('>Freebies</h1>');
    expect(markup).toContain('href="/admin/offers/new"');
    expect(markup).toContain('Add freebie');
    expect(markup).toContain('role="search"');
    expect(markup).toContain('action="/admin/offers"');
    expect(markup).toContain('for="offer-search"');
    expect(markup).toContain('value="coffee"');
    expect(markup).toContain('for="offer-category-filter"');
    expect(markup).toContain('<option value="c1" selected="">Food &amp; drink</option>');
    expect(markup).toContain('Beauty (disabled)');
    expect(markup).toContain('<input type="hidden" name="status" value="draft"/>');
  });

  it('renders the status chips as links, marking only the current one', async () => {
    const markup = html(
      await AdminOffersPage({ searchParams: Promise.resolve({ status: 'expired', q: 'x' }) })
    );
    const nav = markup.slice(markup.indexOf('aria-label="Filter by status"'));
    for (const label of ['All', 'Published', 'Draft', 'Expired', 'Archived']) {
      expect(nav).toContain(`>${label}</a>`);
    }
    expect((nav.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(nav).toMatch(/aria-current="page"[^>]*href="\/admin\/offers\?q=x&amp;status=expired"/);
    expect(nav.indexOf('>Published</a>')).toBeLessThan(nav.indexOf('>Draft</a>'));
    expect(nav).toContain('href="/admin/offers?q=x&amp;status=draft"');
  });

  it('shows skeletons while loading, with the real column headings', async () => {
    const markup = html(await AdminOffersPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Loading offers');
    expect(markup).toContain('Loading offer counts');
    expect(markup).toContain('>Verified</th>');
  });

  it('keeps working, and says so, when the category filter cannot load', async () => {
    mocks.fetchAdminCategories.mockResolvedValue({ success: false, error: SECRET, status: 500 });
    const markup = html(await AdminOffersPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('The category filter could not be loaded.');
    expect(markup).not.toContain('SECRET');
  });
});

describe('OffersResults', () => {
  it('renders a table with names, status pills and verified dates', async () => {
    listOk([
      offer(),
      offer({ id: 'o2', title: 'Draft one', status: 'DRAFT', last_verified_at: null }),
      offer({ id: 'o3', status: 'EXPIRED', category_id: 'c2', title: 'Old one' }),
      offer({ id: 'o4', status: 'ARCHIVED', category_id: 'zzz', title: 'Gone one' }),
    ]);
    const markup = html(await OffersResults({ query: parseOffersQuery({}) }));

    expect(markup).toContain('All offers (4)');
    for (const header of ['Offer', 'Category', 'Status', 'Verified', 'Actions']) {
      expect(markup).toContain(`>${header}</th>`);
    }
    expect(markup).toContain('Good Beans · Free sample');
    expect(markup).toContain('Food &amp; drink');
    expect(markup).toContain('Beauty (disabled)');
    expect(markup).toContain('Unknown');
    expect(markup).toContain('5 Mar 2026');
    expect(markup).toContain('Not verified');
    expect(markup).toContain('bg-good');
    expect(markup).toContain('>Published</span>');
    expect(markup).toContain('>Draft</span>');
    expect(markup).toContain('>Expired</span>');
    expect(markup).toContain('>Archived</span>');
    expect(markup).toContain('bg-warn');
    expect(markup).toContain('bg-info');
    expect(markup).toContain('data-row-actions="o1"');
    expect(markup).toContain('href="/admin/offers/o1"');
    expect(markup).toContain('Showing 1 to 4 of 4 offers');
  });

  it('asks the API for the page, filters and search text', async () => {
    listOk([offer()], 60);
    await OffersResults({
      query: parseOffersQuery({ q: 'tea', status: 'published', category: 'c1', page: '2' }),
    });
    expect(mocks.fetchAdminOffers).toHaveBeenCalledWith({
      search: 'tea',
      status: 'PUBLISHED',
      categoryId: 'c1',
      limit: 25,
      offset: 25,
    });
  });

  it('links to the neighbouring pages, keeping the filters', async () => {
    listOk([offer()], 80);
    const markup = html(
      await OffersResults({ query: parseOffersQuery({ q: 'tea', status: 'draft', page: '2' }) })
    );
    expect(markup).toContain('href="/admin/offers?q=tea&amp;status=draft"');
    expect(markup).toContain('href="/admin/offers?q=tea&amp;status=draft&amp;page=3"');
    expect(markup).toContain('Showing 26 to 26 of 80 offers');
  });

  it('says what an empty result means and offers a way out', async () => {
    listOk([]);
    const filtered = html(await OffersResults({ query: parseOffersQuery({ q: '<b>x</b>' }) }));
    expect(filtered).toContain('No offers match &#x27;&lt;b&gt;x&lt;/b&gt;&#x27;');
    expect(filtered).toContain('Clear filters');
    const none = html(await OffersResults({ query: parseOffersQuery({}) }));
    expect(none).toContain('No offers yet');
    const beyond = html(await OffersResults({ query: parseOffersQuery({ page: '9' }) }));
    expect(beyond).toContain('Back to first page');
  });

  it('shows a curated error with Retry and never the backend text', async () => {
    mocks.fetchAdminOffers.mockResolvedValue({ success: false, error: SECRET, status: 403 });
    const markup = html(await OffersResults({ query: parseOffersQuery({ q: 'tea' }) }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('You do not have permission to do that');
    expect(markup).toContain('href="/admin/offers?q=tea"');
    expect(markup).not.toContain('SECRET');
  });

  it('logs unexpected failures without the backend text', async () => {
    mocks.fetchAdminOffers.mockResolvedValue({ success: false, error: SECRET, status: 500 });
    await OffersResults({ query: parseOffersQuery({}) });
    expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain('SECRET');
  });
});
