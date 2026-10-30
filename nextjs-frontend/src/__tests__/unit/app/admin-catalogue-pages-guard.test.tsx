// @vitest-environment node
/**
 * Every catalogue page asks the admin gate before it reads anything. The /admin layout checks too, but layout and
 * page render in parallel, so without this a non-admin's request would still reach the API.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  fetchAdminOffer: vi.fn(),
  fetchAdminOffers: vi.fn(),
  fetchOfferStatusCounts: vi.fn(),
  fetchAdminCategories: vi.fn(),
  fetchAdminCategory: vi.fn(),
  fetchAdminMerchants: vi.fn(),
  fetchAdminMerchant: vi.fn(),
}));

vi.mock('@/lib/api/admin-guard', () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: <T,>(fn: T) => fn };
});
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api/admin-offers', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/admin-offers')>('@/lib/api/admin-offers');
  return {
    ...actual,
    fetchAdminOffer: mocks.fetchAdminOffer,
    fetchAdminOffers: mocks.fetchAdminOffers,
    fetchOfferStatusCounts: mocks.fetchOfferStatusCounts,
  };
});
vi.mock('@/lib/api/admin-categories', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/admin-categories')>(
    '@/lib/api/admin-categories'
  );
  return {
    ...actual,
    fetchAdminCategories: mocks.fetchAdminCategories,
    fetchAdminCategory: mocks.fetchAdminCategory,
  };
});
vi.mock('@/lib/api/admin-merchants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/admin-merchants')>(
    '@/lib/api/admin-merchants'
  );
  return {
    ...actual,
    fetchAdminMerchants: mocks.fetchAdminMerchants,
    fetchAdminMerchant: mocks.fetchAdminMerchant,
  };
});

import AdminOffersPage from '@/app/(admin)/admin/offers/page';
import NewOfferPage from '@/app/(admin)/admin/offers/new/page';
import EditOfferPage from '@/app/(admin)/admin/offers/[id]/page';
import AdminCategoriesPage from '@/app/(admin)/admin/categories/page';
import NewCategoryPage from '@/app/(admin)/admin/categories/new/page';
import EditCategoryPage from '@/app/(admin)/admin/categories/[id]/page';
import AdminMerchantsPage from '@/app/(admin)/admin/merchants/page';
import NewMerchantPage from '@/app/(admin)/admin/merchants/new/page';
import EditMerchantPage from '@/app/(admin)/admin/merchants/[id]/page';

const PAGES: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ['offers list', () => AdminOffersPage({ searchParams: Promise.resolve({}) })],
  ['new offer', () => NewOfferPage()],
  ['edit offer', () => EditOfferPage({ params: Promise.resolve({ id: 'o1' }) })],
  ['categories list', () => AdminCategoriesPage()],
  ['new category', () => NewCategoryPage()],
  ['edit category', () => EditCategoryPage({ params: Promise.resolve({ id: 'c1' }) })],
  ['merchants list', () => AdminMerchantsPage()],
  ['new merchant', () => NewMerchantPage()],
  ['edit merchant', () => EditMerchantPage({ params: Promise.resolve({ id: 'm1' }) })],
];

const DENIALS: ReadonlyArray<[string, string]> = [
  ['no-session', '/login'],
  ['unverified', '/verify-email'],
  ['rejected', '/api/auth/clear-session'],
  ['not-admin', '/dashboard'],
];

function noWrapperCalled(): void {
  for (const name of [
    'fetchAdminOffer',
    'fetchAdminOffers',
    'fetchOfferStatusCounts',
    'fetchAdminCategories',
    'fetchAdminCategory',
    'fetchAdminMerchants',
    'fetchAdminMerchant',
  ] as const) {
    expect(mocks[name], name).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  const empty = { success: true, data: { total_count: 0, limit: 100, offset: 0 } };
  mocks.fetchAdminCategories.mockResolvedValue({
    success: true,
    data: { ...empty.data, categories: [] },
  });
  mocks.fetchAdminMerchants.mockResolvedValue({
    success: true,
    data: { ...empty.data, merchants: [] },
  });
  mocks.fetchAdminOffer.mockResolvedValue({ success: false, error: 'x', status: 500 });
  mocks.fetchAdminCategory.mockResolvedValue({ success: false, error: 'x', status: 500 });
  mocks.fetchAdminMerchant.mockResolvedValue({ success: false, error: 'x', status: 500 });
});

describe.each(PAGES)('%s page', (_name, render) => {
  it.each(DENIALS)(
    'redirects a %s visitor to %s and reads nothing from the API',
    async (reason, url) => {
      mocks.requireAdminSession.mockResolvedValue({ ok: false, error: 'No', reason });

      await expect(render()).rejects.toThrow(`REDIRECT:${url}`);

      noWrapperCalled();
    }
  );

  it('shows the error page, not content, when the admin check is unavailable', async () => {
    mocks.requireAdminSession.mockResolvedValue({
      ok: false,
      error: 'The admin service is unavailable. Please try again later.',
      reason: 'unavailable',
    });

    await expect(render()).rejects.toThrow('The admin service is unavailable');

    noWrapperCalled();
  });
});

describe('with a confirmed admin', () => {
  it('lets the pages read from the API', async () => {
    mocks.requireAdminSession.mockResolvedValue({ ok: true });

    await AdminOffersPage({ searchParams: Promise.resolve({}) });
    await AdminCategoriesPage();
    await AdminMerchantsPage();
    await NewOfferPage();
    await EditCategoryPage({ params: Promise.resolve({ id: 'c1' }) });
    await EditMerchantPage({ params: Promise.resolve({ id: 'm1' }) });
    await EditOfferPage({ params: Promise.resolve({ id: 'o1' }) });

    expect(mocks.fetchAdminCategories).toHaveBeenCalled();
    expect(mocks.fetchAdminMerchants).toHaveBeenCalled();
    expect(mocks.fetchAdminCategory).toHaveBeenCalledWith('c1');
    expect(mocks.fetchAdminMerchant).toHaveBeenCalledWith('m1');
    expect(mocks.fetchAdminOffer).toHaveBeenCalledWith('o1');
  });
});
