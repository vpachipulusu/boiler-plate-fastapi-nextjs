import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  parseCatalogueParams,
  toCatalogueHref,
  withQuery,
} from '@/lib/catalogue/offer-url';
import type { CatalogueQuery } from '@/lib/catalogue/types';

const paramsFromHref = (href: string): Record<string, string> => {
  const search = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return Object.fromEntries(new URLSearchParams(search));
};

describe('DEFAULT_QUERY', () => {
  it('describes an unfiltered first page sorted by newest', () => {
    expect(DEFAULT_QUERY).toEqual({
      q: '',
      category: null,
      types: [],
      postage: null,
      sort: 'newest',
      page: 1,
    });
  });
});

describe('parseCatalogueParams', () => {
  it('returns the defaults for empty params', () => {
    expect(parseCatalogueParams({})).toEqual(DEFAULT_QUERY);
  });

  it('normalises the search text', () => {
    expect(parseCatalogueParams({ q: '  tea   kit ' }).q).toBe('tea kit');
  });

  it('uses the first value when a param is repeated', () => {
    expect(parseCatalogueParams({ q: ['first', 'second'] }).q).toBe('first');
  });

  it('accepts a known category slug', () => {
    expect(parseCatalogueParams({ category: 'pets' }).category).toBe('pets');
  });

  it('drops an unknown category slug', () => {
    expect(parseCatalogueParams({ category: 'cars' }).category).toBeNull();
  });

  it('reads comma-separated types and drops unknown ones', () => {
    expect(parseCatalogueParams({ type: 'voucher,nonsense,free_sample' }).types).toEqual([
      'free_sample',
      'voucher',
    ]);
  });

  it('reads repeated type params and de-duplicates in OFFER_TYPES order', () => {
    const result = parseCatalogueParams({ type: ['cashback', 'free_trial,cashback'] });

    expect(result.types).toEqual(['free_trial', 'cashback']);
  });

  it('only accepts "free" for postage', () => {
    expect(parseCatalogueParams({ postage: 'free' }).postage).toBe('free');
    expect(parseCatalogueParams({ postage: 'paid' }).postage).toBeNull();
  });

  it('accepts known sort keys and falls back to newest otherwise', () => {
    expect(parseCatalogueParams({ sort: 'a_z' }).sort).toBe('a_z');
    expect(parseCatalogueParams({ sort: 'ending_soon' }).sort).toBe('ending_soon');
    expect(parseCatalogueParams({ sort: 'cheapest' }).sort).toBe('newest');
  });

  it('accepts a positive integer page and caps it at 999', () => {
    expect(parseCatalogueParams({ page: '4' }).page).toBe(4);
    expect(parseCatalogueParams({ page: '5000' }).page).toBe(999);
  });

  it.each(['0', '-3', '2.5', 'abc', '', '1e3'])('falls back to page 1 for "%s"', (page) => {
    expect(parseCatalogueParams({ page }).page).toBe(1);
  });
});

describe('toCatalogueHref', () => {
  it('returns the base path when nothing differs from the defaults', () => {
    expect(toCatalogueHref({})).toBe('/freebies');
    expect(toCatalogueHref(DEFAULT_QUERY)).toBe('/freebies');
  });

  it('supports a custom base path', () => {
    expect(toCatalogueHref({ category: 'pets' }, '/categories')).toBe('/categories?category=pets');
  });

  it('omits default values and keeps the rest', () => {
    const href = toCatalogueHref({ q: 'tea', sort: 'newest', page: 1, types: [] });

    expect(href).toBe('/freebies?q=tea');
  });

  it('joins types with commas and encodes special characters', () => {
    const href = toCatalogueHref({ q: 'tea & coffee', types: ['free_sample', 'voucher'] });

    expect(paramsFromHref(href)).toEqual({ q: 'tea & coffee', type: 'free_sample,voucher' });
  });

  it('writes every non-default field', () => {
    const href = toCatalogueHref({
      q: 'x',
      category: 'beauty',
      types: ['cashback'],
      postage: 'free',
      sort: 'a_z',
      page: 3,
    });

    expect(paramsFromHref(href)).toEqual({
      q: 'x',
      category: 'beauty',
      type: 'cashback',
      postage: 'free',
      sort: 'a_z',
      page: '3',
    });
  });
});

describe('catalogue URL round trip', () => {
  const states: Partial<CatalogueQuery>[] = [
    {},
    { q: 'face cream' },
    { category: 'food-drink', sort: 'ending_soon' },
    { types: ['free_trial', 'competition'], postage: 'free' },
    { q: 'a&b=c', category: 'pets', types: ['voucher'], postage: 'free', sort: 'a_z', page: 7 },
  ];

  it.each(states)('parses back what it wrote for %j', (state) => {
    // Arrange
    const expected: CatalogueQuery = { ...DEFAULT_QUERY, ...state };

    // Act
    const href = toCatalogueHref(expected);
    const parsed = parseCatalogueParams(paramsFromHref(href));

    // Assert
    expect(parsed).toEqual(expected);
  });
});

describe('withQuery', () => {
  const current: CatalogueQuery = { ...DEFAULT_QUERY, category: 'pets', page: 3 };

  it('resets the page to 1 when a filter changes', () => {
    expect(withQuery(current, { category: 'beauty' })).toMatchObject({
      category: 'beauty',
      page: 1,
    });
  });

  it('resets the page to 1 when the search text, types, postage or sort change', () => {
    expect(withQuery(current, { q: 'tea' }).page).toBe(1);
    expect(withQuery(current, { types: ['voucher'] }).page).toBe(1);
    expect(withQuery(current, { postage: 'free' }).page).toBe(1);
    expect(withQuery(current, { sort: 'a_z' }).page).toBe(1);
  });

  it('keeps the requested page when only the page changes', () => {
    expect(withQuery(current, { page: 5 })).toMatchObject({ category: 'pets', page: 5 });
  });

  it('resets the page even when a page is supplied alongside a filter change', () => {
    expect(withQuery(current, { category: 'beauty', page: 4 }).page).toBe(1);
  });

  it('keeps the page when the patch does not change any value', () => {
    expect(withQuery(current, { category: 'pets' }).page).toBe(3);
  });

  it('returns a new object and never mutates the current query', () => {
    const snapshot = structuredClone(current);

    const next = withQuery(current, { q: 'tea' });

    expect(next).not.toBe(current);
    expect(current).toEqual(snapshot);
  });
});
