import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Offer } from '@/lib/catalogue/types';

const mocks = vi.hoisted(() => ({ notFound: vi.fn(), liveOffers: vi.fn() }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    mocks.notFound();
    throw new Error('NEXT_NOT_FOUND');
  },
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

// Everything is the real facade except `getLiveOffers` and `getOfferBySlug`, which the tests can
// point at API-shaped offers to prove the indexing flip needs no code change.
vi.mock('@/lib/catalogue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalogue')>();
  return {
    ...actual,
    getLiveOffers: (...args: Parameters<typeof actual.getLiveOffers>) =>
      mocks.liveOffers.getMockImplementation()
        ? mocks.liveOffers(...args)
        : actual.getLiveOffers(...args),
    getOfferBySlug: async (slug: string) => {
      const overridden = (await mocks.liveOffers())?.find((offer: Offer) => offer.slug === slug);
      return overridden ?? actual.getOfferBySlug(slug);
    },
  };
});

import CategoryPage, {
  generateMetadata as categoryMetadata,
} from '@/app/(public)/category/[slug]/page';
import OfferPage, { generateMetadata as offerMetadata } from '@/app/(public)/freebies/[slug]/page';
import { generateMetadata as freebiesMetadata } from '@/app/(public)/freebies/page';
import HomePage, { generateMetadata as homeMetadata } from '@/app/(public)/page';
import { metadata as alertsMetadata } from '@/app/(public)/alerts/page';
import { OFFERS } from '@/lib/catalogue/fixtures';

const FIXTURE_LIVE = OFFERS.find(
  (offer) => offer.status === 'published' && offer.endAt && offer.categorySlug === 'beauty'
) as Offer;
const FIXTURE_EXPIRED = OFFERS.find((offer) => offer.status === 'expired') as Offer;

const apiOffer = (patch: Partial<Offer> = {}): Offer => ({
  ...FIXTURE_LIVE,
  source: 'api',
  demo: false,
  endAt: '2027-01-31',
  ...patch,
});

const search = (params: Record<string, string>) => ({ searchParams: Promise.resolve(params) });

const jsonLdOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('script[type="application/ld+json"]')).flatMap((script) => {
    const parsed = JSON.parse(script.textContent ?? 'null');
    return Array.isArray(parsed) ? parsed : [parsed];
  });

beforeEach(() => {
  mocks.notFound.mockClear();
  mocks.liveOffers.mockReset();
});

describe('fixture-backed catalogue', () => {
  it('keeps the home page, /freebies and the alerts page out of search', async () => {
    expect((await homeMetadata()).robots).toEqual({ index: false });
    expect((await freebiesMetadata(search({}))).robots).toEqual({ index: false });
    expect(alertsMetadata.robots).toEqual({ index: false });
    expect(alertsMetadata.alternates?.canonical).toBe('/alerts');
  });

  it('keeps a live fixture offer out of search', async () => {
    const metadata = await offerMetadata({ params: Promise.resolve({ slug: FIXTURE_LIVE.slug }) });

    expect(metadata.robots).toEqual({ index: false });
  });

  it('marks an expired fixture offer noindex, follow while keeping its canonical', async () => {
    const metadata = await offerMetadata({
      params: Promise.resolve({ slug: FIXTURE_EXPIRED.slug }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(`/freebies/${FIXTURE_EXPIRED.slug}`);
  });

  it('keeps a category out of search and canonical to its own path', async () => {
    const metadata = await categoryMetadata({ params: Promise.resolve({ slug: 'beauty' }) });

    expect(metadata.robots).toEqual({ index: false });
    expect(metadata.alternates?.canonical).toBe('/category/beauty');
    expect(metadata.openGraph).toMatchObject({ url: '/category/beauty', siteName: 'Freejoy' });
  });
});

describe('once the catalogue is API-backed', () => {
  beforeEach(() => mocks.liveOffers.mockResolvedValue([apiOffer()]));

  it('makes the home page and unfiltered /freebies indexable', async () => {
    expect((await homeMetadata()).robots).toMatchObject({ index: true, follow: true });
    expect((await freebiesMetadata(search({}))).robots).toMatchObject({ index: true });
  });

  it.each([
    ['a search', { q: 'tea' }],
    ['a category filter', { category: 'beauty' }],
    ['a type filter', { type: 'voucher' }],
    ['a postage filter', { postage: 'free' }],
    ['a sort', { sort: 'a_z' }],
    ['page 2', { page: '2' }],
  ])(
    'sends /freebies with %s to noindex, follow, canonical to /freebies',
    async (_name, params) => {
      const metadata = await freebiesMetadata(search(params));

      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.alternates?.canonical).toBe('/freebies');
    }
  );

  it('makes a category indexable, but not its filtered or paged views', async () => {
    const params = Promise.resolve({ slug: 'beauty' });

    expect((await categoryMetadata({ params })).robots).toMatchObject({ index: true });
    expect(
      (await categoryMetadata({ params, searchParams: Promise.resolve({ page: '2' }) })).robots
    ).toEqual({ index: false, follow: true });
    expect(
      (await categoryMetadata({ params, searchParams: Promise.resolve({ q: 'x' }) })).robots
    ).toEqual({ index: false, follow: true });
  });

  it('makes a live API offer indexable', async () => {
    const metadata = await offerMetadata({ params: Promise.resolve({ slug: FIXTURE_LIVE.slug }) });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it('keeps the alerts page noindex until its form is live', () => {
    expect(alertsMetadata.robots).toEqual({ index: false });
  });
});

describe('API offers that have ended', () => {
  it('answers with the ended state and noindex, follow within 30 days of endAt', async () => {
    mocks.liveOffers.mockResolvedValue([apiOffer({ status: 'expired', endAt: '2026-10-24' })]);

    const metadata = await offerMetadata({ params: Promise.resolve({ slug: FIXTURE_LIVE.slug }) });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    const { container } = render(
      await OfferPage({ params: Promise.resolve({ slug: FIXTURE_LIVE.slug }) })
    );
    expect(container.textContent).toContain('This offer has ended');
  });

  it('is gone (not found for now) more than 30 days after endAt', async () => {
    mocks.liveOffers.mockResolvedValue([apiOffer({ status: 'expired', endAt: '2026-09-01' })]);
    const params = Promise.resolve({ slug: FIXTURE_LIVE.slug });

    expect((await offerMetadata({ params })).title).toBe('Offer not found');
    await expect(OfferPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });
});

describe('page JSON-LD', () => {
  it('puts WebSite and Organization on the home page and nothing priced', async () => {
    const { container } = render(await HomePage());
    const nodes = jsonLdOf(container);

    expect(nodes.map((node) => node['@type'])).toEqual(['WebSite', 'Organization']);
    expect(JSON.stringify(nodes)).not.toMatch(/price|availability|rating|review|"Offer"|Product/i);
  });

  it('puts a Home > category > offer BreadcrumbList on an offer page', async () => {
    const { container } = render(
      await OfferPage({ params: Promise.resolve({ slug: FIXTURE_LIVE.slug }) })
    );
    const [breadcrumbs] = jsonLdOf(container);

    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    expect(breadcrumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual([
      'Home',
      'Beauty',
      FIXTURE_LIVE.title,
    ]);
    expect(breadcrumbs.itemListElement[2].item).toBe(
      `http://localhost:3000/freebies/${FIXTURE_LIVE.slug}`
    );
  });

  it('puts a Home > category BreadcrumbList on a category page', async () => {
    // The catalogue below the intro streams through Suspense, so render only the JSON-LD child.
    const page = await CategoryPage({
      params: Promise.resolve({ slug: 'beauty' }),
      searchParams: Promise.resolve({}),
    });
    const [, , jsonLd] = (page as ReactElement<{ children: ReactElement[] }>).props.children;
    const { container } = render(jsonLd as ReactElement);
    const [breadcrumbs] = jsonLdOf(container);

    expect(breadcrumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual([
      'Home',
      'Beauty',
    ]);
  });
});
