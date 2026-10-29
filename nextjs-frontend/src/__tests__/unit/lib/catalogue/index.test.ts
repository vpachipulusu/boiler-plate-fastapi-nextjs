import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  FRESHNESS_LABELS,
  OFFER_TYPE_LABELS,
  SORT_LABELS,
  getCategories,
  getCategoryBySlug,
  getFeaturedOffers,
  getLiveOffers,
  getMerchantBySlug,
  getMerchants,
  getOfferBySlug,
  getRelatedOffers,
  getToday,
  normaliseQuery,
  parseCatalogueParams,
  searchOffers,
  toCatalogueHref,
  withQuery,
} from '@/lib/catalogue';
import { FIXTURE_TODAY } from '@/lib/catalogue/fixtures';

describe('catalogue facade re-exports', () => {
  it('exposes the label maps and url helpers', () => {
    expect(OFFER_TYPE_LABELS.free_sample).toBe('Free sample');
    expect(FRESHNESS_LABELS.ends_soon).toBe('Ends soon');
    expect(SORT_LABELS.a_z).toBe('A to Z');
    expect(toCatalogueHref(DEFAULT_QUERY)).toBe('/freebies');
    expect(parseCatalogueParams({ sort: 'a_z' }).sort).toBe('a_z');
    expect(withQuery(DEFAULT_QUERY, { page: 2 }).page).toBe(2);
    expect(normaliseQuery('  a   b ')).toBe('a b');
  });
});

describe('getToday', () => {
  it('returns the fixture date', async () => {
    expect(await getToday()).toBe(FIXTURE_TODAY);
  });
});

describe('categories and merchants', () => {
  it('lists the six categories in sort order', async () => {
    const categories = await getCategories();

    expect(categories.map((category) => category.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('finds a category by slug and returns null for an unknown slug', async () => {
    expect((await getCategoryBySlug('pets'))?.name).toBe('Pets');
    expect(await getCategoryBySlug('cars')).toBeNull();
  });

  it('returns copies so callers cannot mutate the fixtures', async () => {
    const first = await getCategoryBySlug('pets');
    const second = await getCategoryBySlug('pets');

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it('lists the eight merchants', async () => {
    expect(await getMerchants()).toHaveLength(8);
  });

  it('finds a merchant by slug and returns null for an unknown slug', async () => {
    expect((await getMerchantBySlug('tea-time'))?.name).toBe('Tea Time');
    expect(await getMerchantBySlug('nobody')).toBeNull();
  });
});

describe('getOfferBySlug', () => {
  it('returns a published offer', async () => {
    expect((await getOfferBySlug('coffee-discovery-pack'))?.status).toBe('published');
  });

  it('returns an expired offer so the detail page can show the ended state', async () => {
    expect((await getOfferBySlug('laundry-sheets-sample'))?.status).toBe('expired');
  });

  it('returns null for a draft offer', async () => {
    expect(await getOfferBySlug('cat-pouch-tasting-sample')).toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    expect(await getOfferBySlug('does-not-exist')).toBeNull();
  });
});

describe('getLiveOffers and getFeaturedOffers', () => {
  it('returns only live offers, newest first', async () => {
    const live = await getLiveOffers();

    expect(live).toHaveLength(21);
    expect(live.every((offer) => offer.status === 'published')).toBe(true);
    const starts = live.map((offer) => offer.startAt);
    expect(starts).toEqual([...starts].sort().reverse());
  });

  it('returns up to eight featured live offers by default', async () => {
    const featured = await getFeaturedOffers();

    expect(featured).toHaveLength(8);
    expect(featured.every((offer) => offer.featured)).toBe(true);
  });

  it('honours a smaller limit', async () => {
    expect(await getFeaturedOffers(3)).toHaveLength(3);
    expect(await getFeaturedOffers(0)).toEqual([]);
  });
});

describe('searchOffers', () => {
  it('returns the first page of live offers by default', async () => {
    const result = await searchOffers(DEFAULT_QUERY);

    expect(result).toMatchObject({ page: 1, pageCount: 2, total: 21, from: 1, to: 12 });
    expect(result.items).toHaveLength(12);
  });

  it('returns the second page with the remaining offers', async () => {
    const result = await searchOffers({ ...DEFAULT_QUERY, page: 2 });

    expect(result).toMatchObject({ page: 2, from: 13, to: 21 });
    expect(result.items).toHaveLength(9);
  });

  it('clamps an out-of-range page', async () => {
    expect((await searchOffers({ ...DEFAULT_QUERY, page: 99 })).page).toBe(2);
  });

  it('filters by category and sorts A to Z', async () => {
    const result = await searchOffers({ ...DEFAULT_QUERY, category: 'food-drink', sort: 'a_z' });
    const titles = result.items.map((offer) => offer.title);

    expect(result.total).toBe(4);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'en-GB')));
  });

  it('matches merchant names in the search text', async () => {
    const result = await searchOffers({ ...DEFAULT_QUERY, q: 'tiny days' });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((offer) => offer.merchantSlug === 'tiny-days')).toBe(true);
  });

  it('returns an empty page when nothing matches', async () => {
    const result = await searchOffers({ ...DEFAULT_QUERY, q: 'zzzz-nothing' });

    expect(result).toMatchObject({ items: [], total: 0, from: 0, to: 0, pageCount: 1 });
  });
});

describe('getRelatedOffers', () => {
  it('returns live offers related to the given offer, excluding itself', async () => {
    const offer = await getOfferBySlug('treats-for-happy-pups');
    if (!offer) throw new Error('Missing fixture offer');

    const related = await getRelatedOffers(offer, 3);

    expect(related).toHaveLength(3);
    expect(related.some((entry) => entry.id === offer.id)).toBe(false);
    expect(related.every((entry) => entry.status === 'published')).toBe(true);
  });

  it('defaults to four results', async () => {
    const offer = await getOfferBySlug('treats-for-happy-pups');
    if (!offer) throw new Error('Missing fixture offer');

    expect(await getRelatedOffers(offer)).toHaveLength(4);
  });
});
