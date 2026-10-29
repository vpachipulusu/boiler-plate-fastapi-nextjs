import { describe, expect, it } from 'vitest';
import { CATEGORIES, FIXTURE_TODAY, MERCHANTS, OFFERS } from '@/lib/catalogue/fixtures';
import {
  filterOffers,
  isLive,
  normaliseQuery,
  paginate,
  relatedOffers,
  sortOffers,
} from '@/lib/catalogue/query';
import { DEFAULT_QUERY } from '@/lib/catalogue/offer-url';
import type { CatalogueQuery, Offer } from '@/lib/catalogue/types';

const OPTIONS = { today: FIXTURE_TODAY, merchants: MERCHANTS, categories: CATEGORIES };

const query = (patch: Partial<CatalogueQuery> = {}): CatalogueQuery => ({
  ...DEFAULT_QUERY,
  ...patch,
});

const bySlug = (slug: string): Offer => {
  const offer = OFFERS.find((entry) => entry.slug === slug);
  if (!offer) throw new Error(`Missing fixture offer ${slug}`);
  return offer;
};

const makeOffer = (patch: Partial<Offer>): Offer => ({ ...(OFFERS[0] as Offer), ...patch });

describe('normaliseQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normaliseQuery('  face   cream \t sample  ')).toBe('face cream sample');
  });

  it('caps the text at 80 characters without a trailing space', () => {
    const result = normaliseQuery(`${'a'.repeat(79)} ${'b'.repeat(20)}`);

    expect(result).toHaveLength(79);
    expect(result.endsWith(' ')).toBe(false);
  });

  it('returns an empty string for blank input', () => {
    expect(normaliseQuery('   ')).toBe('');
  });
});

describe('isLive', () => {
  it('treats a published offer with no end date as live', () => {
    expect(isLive(makeOffer({ status: 'published', endAt: null }), FIXTURE_TODAY)).toBe(true);
  });

  it('treats an offer ending today as still live', () => {
    expect(isLive(makeOffer({ endAt: FIXTURE_TODAY }), FIXTURE_TODAY)).toBe(true);
  });

  it('treats an offer that ended yesterday as not live', () => {
    expect(isLive(makeOffer({ endAt: '2026-10-28' }), FIXTURE_TODAY)).toBe(false);
  });

  it.each(['draft', 'expired', 'archived'] as const)('treats a %s offer as not live', (status) => {
    expect(isLive(makeOffer({ status, endAt: null }), FIXTURE_TODAY)).toBe(false);
  });
});

describe('filterOffers', () => {
  it('excludes draft and expired offers by default', () => {
    const result = filterOffers(OFFERS, query(), OPTIONS);

    expect(result).toHaveLength(21);
    expect(result.every((offer) => offer.status === 'published')).toBe(true);
  });

  it('includes expired offers but never drafts when includeExpired is set', () => {
    const result = filterOffers(OFFERS, query(), { ...OPTIONS, includeExpired: true });

    expect(result).toHaveLength(23);
    expect(result.some((offer) => offer.status === 'expired')).toBe(true);
    expect(result.some((offer) => offer.status === 'draft')).toBe(false);
  });

  it('excludes archived offers even when includeExpired is set', () => {
    const archived = makeOffer({ id: 'x', status: 'archived' });

    expect(filterOffers([archived], query(), { ...OPTIONS, includeExpired: true })).toEqual([]);
  });

  it('hides a published offer whose end date has passed', () => {
    const lapsed = makeOffer({ endAt: '2026-10-01' });

    expect(filterOffers([lapsed], query(), OPTIONS)).toEqual([]);
  });

  it('filters by category slug', () => {
    const result = filterOffers(OFFERS, query({ category: 'pets' }), OPTIONS);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((offer) => offer.categorySlug === 'pets')).toBe(true);
  });

  it('keeps every offer type when no types are selected', () => {
    const types = new Set(
      filterOffers(OFFERS, query({ types: [] }), OPTIONS).map((o) => o.offerType)
    );

    expect(types.size).toBe(5);
  });

  it('filters by one or more offer types', () => {
    const result = filterOffers(OFFERS, query({ types: ['cashback', 'voucher'] }), OPTIONS);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((o) => o.offerType === 'cashback' || o.offerType === 'voucher')).toBe(true);
  });

  it('keeps only offers with free postage when postage is "free"', () => {
    const result = filterOffers(OFFERS, query({ postage: 'free' }), OPTIONS);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((offer) => offer.postage.kind === 'free')).toBe(true);
  });

  it('matches the search text against the title case-insensitively', () => {
    const result = filterOffers(OFFERS, query({ q: 'COFFEE DISCOVERY' }), OPTIONS);

    expect(result.map((offer) => offer.slug)).toEqual(['coffee-discovery-pack']);
  });

  it('matches the search text against the summary', () => {
    const result = filterOffers(OFFERS, query({ q: 'dry autumn days' }), OPTIONS);

    expect(result.map((offer) => offer.slug)).toEqual(['mini-hydrating-lip-balm']);
  });

  it('matches the search text against the merchant name', () => {
    const result = filterOffers(OFFERS, query({ q: 'happy paws' }), OPTIONS);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((offer) => offer.merchantSlug === 'happy-paws')).toBe(true);
  });

  it('matches the search text against the category name', () => {
    const result = filterOffers(OFFERS, query({ q: 'baby & kids' }), OPTIONS);

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((offer) => offer.categorySlug === 'baby-kids')).toBe(true);
  });

  it('ignores merchant and category names when they are not supplied', () => {
    const result = filterOffers(OFFERS, query({ q: 'happy paws' }), { today: FIXTURE_TODAY });

    expect(result).toEqual([]);
  });

  it('returns nothing when the search text matches no offer', () => {
    expect(filterOffers(OFFERS, query({ q: 'zzzz-nothing' }), OPTIONS)).toEqual([]);
  });

  it('combines category, type and search filters', () => {
    const result = filterOffers(
      OFFERS,
      query({ category: 'food-drink', types: ['free_sample'], q: 'tea' }),
      OPTIONS
    );

    expect(result.map((offer) => offer.slug)).toEqual(['everyday-tea-tasting-kit']);
  });

  it('does not mutate the input array', () => {
    const copy = [...OFFERS];

    filterOffers(OFFERS, query({ category: 'pets' }), OPTIONS);

    expect(OFFERS).toEqual(copy);
  });
});

describe('sortOffers', () => {
  it('sorts newest by start date descending, then title', () => {
    const a = makeOffer({ id: 'a', title: 'Beta', startAt: '2026-10-10' });
    const b = makeOffer({ id: 'b', title: 'Alpha', startAt: '2026-10-10' });
    const c = makeOffer({ id: 'c', title: 'Zed', startAt: '2026-10-20' });

    expect(sortOffers([a, b, c], 'newest').map((o) => o.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts ending soon with end dates ascending before open-ended offers', () => {
    const late = makeOffer({ id: 'late', title: 'Late', endAt: '2026-12-01' });
    const soon = makeOffer({ id: 'soon', title: 'Soon', endAt: '2026-11-01' });
    const tie = makeOffer({ id: 'tie', title: 'Aardvark', endAt: '2026-11-01' });
    const openOld = makeOffer({ id: 'open-old', title: 'Old', endAt: null, startAt: '2026-10-01' });
    const openNew = makeOffer({ id: 'open-new', title: 'New', endAt: null, startAt: '2026-10-25' });

    const result = sortOffers([openOld, late, openNew, soon, tie], 'ending_soon');

    expect(result.map((o) => o.id)).toEqual(['tie', 'soon', 'late', 'open-new', 'open-old']);
  });

  it('sorts A to Z using British English collation', () => {
    const result = sortOffers(OFFERS, 'a_z');
    const titles = result.map((offer) => offer.title);

    expect(titles).toEqual([...titles].sort((x, y) => x.localeCompare(y, 'en-GB')));
  });

  it('returns a new array and leaves the input order untouched', () => {
    const input = [...OFFERS];

    const result = sortOffers(input, 'a_z');

    expect(result).not.toBe(input);
    expect(input).toEqual(OFFERS);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 30 }, (_, index) => index + 1);

  it('returns the first page with 1-based bounds', () => {
    expect(paginate(items, 1, 12)).toEqual({
      items: items.slice(0, 12),
      page: 1,
      pageCount: 3,
      total: 30,
      from: 1,
      to: 12,
    });
  });

  it('returns a short last page', () => {
    expect(paginate(items, 3, 12)).toMatchObject({ page: 3, from: 25, to: 30 });
  });

  it('clamps a page that is too high or too low', () => {
    expect(paginate(items, 99, 12).page).toBe(3);
    expect(paginate(items, 0, 12).page).toBe(1);
    expect(paginate(items, -4, 12).page).toBe(1);
  });

  it('falls back to page 1 for a non-finite page', () => {
    expect(paginate(items, Number.NaN, 12).page).toBe(1);
  });

  it('reports one empty page for an empty list', () => {
    expect(paginate([], 5)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
  });

  it('uses the catalogue page size by default', () => {
    expect(paginate(items, 1).items).toHaveLength(12);
  });

  it('treats a non-positive page size as one item per page', () => {
    expect(paginate(items, 1, 0).pageCount).toBe(30);
  });
});

describe('relatedOffers', () => {
  const source = bySlug('glow-boosting-face-cream-sample');

  it('returns live offers from the same category, newest first, excluding the offer itself', () => {
    const result = relatedOffers(source, OFFERS, FIXTURE_TODAY, 3);

    expect(result).toHaveLength(3);
    expect(result.every((offer) => offer.categorySlug === 'beauty')).toBe(true);
    expect(result.some((offer) => offer.id === source.id)).toBe(false);
    const starts = result.map((offer) => offer.startAt);
    expect(starts).toEqual([...starts].sort().reverse());
  });

  it('pads with other live featured offers when the category is too small', () => {
    const result = relatedOffers(source, OFFERS, FIXTURE_TODAY, 6);

    expect(result).toHaveLength(6);
    const padding = result.filter((offer) => offer.categorySlug !== 'beauty');
    expect(padding.length).toBe(3);
    expect(padding.every((offer) => offer.featured)).toBe(true);
  });

  it('never returns expired or draft offers', () => {
    const result = relatedOffers(bySlug('laundry-sheets-sample'), OFFERS, FIXTURE_TODAY, 20);

    expect(result.every((offer) => offer.status === 'published')).toBe(true);
  });

  it('defaults to four results', () => {
    expect(relatedOffers(source, OFFERS, FIXTURE_TODAY)).toHaveLength(4);
  });

  it('returns an empty list when the limit is zero or negative', () => {
    expect(relatedOffers(source, OFFERS, FIXTURE_TODAY, 0)).toEqual([]);
    expect(relatedOffers(source, OFFERS, FIXTURE_TODAY, -2)).toEqual([]);
  });
});
