import { describe, expect, it } from 'vitest';
import { CATEGORIES, FIXTURE_TODAY, OFFERS } from '@/lib/catalogue/fixtures';
import { DEFAULT_QUERY } from '@/lib/catalogue/offer-url';
import type { Category, Offer } from '@/lib/catalogue/types';
import {
  daysBetween,
  EXPIRED_NOINDEX_DAYS,
  expiredIndexingPolicy,
  isCatalogueApiBacked,
  isIndexableCategory,
  isIndexableOffer,
  isRefinedQuery,
} from '@/lib/seo/indexing';
import {
  INDEXABLE_ROBOTS,
  listingRobots,
  NOINDEX_FOLLOW_ROBOTS,
  NOINDEX_ROBOTS,
  offerRobots,
  openGraphFor,
} from '@/lib/seo/metadata';

const TODAY = '2026-10-29';

const fixtureOffer = (OFFERS.find((offer) => offer.status === 'published') ?? OFFERS[0]) as Offer;

/** The shape the catalogue API will return once FREEJ-21 lands. */
const apiOffer = (patch: Partial<Offer> = {}): Offer => ({
  ...fixtureOffer,
  source: 'api',
  demo: false,
  status: 'published',
  endAt: null,
  ...patch,
});

const category = (patch: Partial<Category> = {}): Category => ({
  ...(CATEGORIES[0] as Category),
  ...patch,
});

describe('isIndexableOffer', () => {
  it('is never true for a fixture offer, whatever its status or dates', () => {
    for (const offer of OFFERS) {
      expect(isIndexableOffer(offer, FIXTURE_TODAY)).toBe(false);
    }
  });

  it('is true for a published, live offer that came from the API', () => {
    expect(isIndexableOffer(apiOffer(), TODAY)).toBe(true);
    expect(isIndexableOffer(apiOffer({ endAt: TODAY }), TODAY)).toBe(true);
  });

  it('is false for API offers that are demo, not published or already ended', () => {
    expect(isIndexableOffer(apiOffer({ demo: true }), TODAY)).toBe(false);
    expect(isIndexableOffer(apiOffer({ status: 'draft' }), TODAY)).toBe(false);
    expect(isIndexableOffer(apiOffer({ status: 'expired' }), TODAY)).toBe(false);
    expect(isIndexableOffer(apiOffer({ endAt: '2026-10-28' }), TODAY)).toBe(false);
  });
});

describe('isCatalogueApiBacked and isIndexableCategory', () => {
  it('treats an all-fixture catalogue as not API-backed', () => {
    expect(isCatalogueApiBacked(OFFERS)).toBe(false);
    expect(isIndexableCategory(category(), OFFERS)).toBe(false);
  });

  it('treats any API offer as an API-backed catalogue', () => {
    const offers = [fixtureOffer, apiOffer()];

    expect(isCatalogueApiBacked(offers)).toBe(true);
    expect(isIndexableCategory(category(), offers)).toBe(true);
  });

  it('never indexes a disabled category', () => {
    expect(isIndexableCategory(category({ enabled: false }), [apiOffer()])).toBe(false);
  });
});

describe('isRefinedQuery', () => {
  it('is false only for the default query', () => {
    expect(isRefinedQuery(DEFAULT_QUERY)).toBe(false);
  });

  it.each([
    ['search', { q: 'tea' }],
    ['category', { category: 'beauty' }],
    ['type', { types: ['voucher' as const] }],
    ['postage', { postage: 'free' as const }],
    ['sort', { sort: 'a_z' as const }],
    ['page 2', { page: 2 }],
  ])('is true for a %s', (_name, patch) => {
    expect(isRefinedQuery({ ...DEFAULT_QUERY, ...patch })).toBe(true);
  });
});

describe('daysBetween', () => {
  it('counts whole days between ISO dates, across month ends', () => {
    expect(daysBetween('2026-10-24', '2026-10-29')).toBe(5);
    expect(daysBetween('2026-09-29', '2026-10-29')).toBe(30);
    expect(daysBetween('2026-10-29', '2026-10-28')).toBe(-1);
  });

  it('is NaN for something that is not a date', () => {
    expect(daysBetween('soon', TODAY)).toBeNaN();
  });
});

describe('expiredIndexingPolicy', () => {
  it('leaves a live offer to the data-driven indexing rules', () => {
    expect(expiredIndexingPolicy(apiOffer(), TODAY)).toEqual({
      state: 'live',
      httpStatus: 200,
      noindex: false,
    });
  });

  it('answers 200 with noindex for an offer that ended up to 30 days ago', () => {
    const ended = apiOffer({ status: 'expired', endAt: '2026-10-24' });
    const lastDay = apiOffer({ status: 'expired', endAt: '2026-09-29' });

    for (const offer of [ended, lastDay]) {
      expect(expiredIndexingPolicy(offer, TODAY)).toEqual({
        state: 'ended',
        httpStatus: 200,
        noindex: true,
      });
    }
    expect(EXPIRED_NOINDEX_DAYS).toBe(30);
  });

  it('treats a published offer whose end date has passed as ended too', () => {
    const stale = apiOffer({ status: 'published', endAt: '2026-10-28' });

    expect(expiredIndexingPolicy(stale, TODAY).state).toBe('ended');
  });

  it('answers 410 once more than 30 days have passed since the end date', () => {
    const gone = apiOffer({ status: 'expired', endAt: '2026-09-28' });

    expect(expiredIndexingPolicy(gone, TODAY)).toEqual({
      state: 'gone',
      httpStatus: 410,
      noindex: true,
    });
  });

  it('keeps an expired offer without an end date in the ended state', () => {
    expect(expiredIndexingPolicy(apiOffer({ status: 'expired', endAt: null }), TODAY).state).toBe(
      'ended'
    );
  });

  it('has no public page for draft or archived offers', () => {
    for (const status of ['draft', 'archived'] as const) {
      expect(expiredIndexingPolicy(apiOffer({ status }), TODAY)).toEqual({
        state: 'unavailable',
        httpStatus: 404,
        noindex: true,
      });
    }
  });
});

describe('robots builders', () => {
  it('keeps fixture-backed listings out of search with a bare noindex', () => {
    expect(listingRobots({ indexable: false })).toEqual(NOINDEX_ROBOTS);
    expect(NOINDEX_ROBOTS).toEqual({ index: false });
  });

  it('makes an unrefined listing indexable once the data allows it', () => {
    expect(listingRobots({ indexable: true })).toEqual(INDEXABLE_ROBOTS);
    expect(INDEXABLE_ROBOTS).toMatchObject({ index: true, follow: true });
  });

  it('always sends a refined listing to noindex, follow', () => {
    expect(listingRobots({ indexable: true, refined: true })).toEqual(NOINDEX_FOLLOW_ROBOTS);
    expect(listingRobots({ indexable: false, refined: true })).toEqual({
      index: false,
      follow: true,
    });
  });

  it('indexes a live API offer, keeps a live fixture out and noindexes an ended one', () => {
    expect(offerRobots(apiOffer(), TODAY)).toEqual(INDEXABLE_ROBOTS);
    expect(offerRobots(fixtureOffer, FIXTURE_TODAY)).toEqual(NOINDEX_ROBOTS);
    expect(offerRobots(apiOffer({ status: 'expired', endAt: '2026-10-24' }), TODAY)).toEqual(
      NOINDEX_FOLLOW_ROBOTS
    );
  });

  it('builds Open Graph with the canonical path as the url', () => {
    expect(
      openGraphFor({ title: 'T', description: 'D', path: '/freebies', type: 'article' })
    ).toMatchObject({ type: 'article', url: '/freebies', title: 'T', locale: 'en_GB' });
    expect(openGraphFor({ title: 'T', description: 'D', path: '/' })).toMatchObject({
      type: 'website',
    });
  });
});
