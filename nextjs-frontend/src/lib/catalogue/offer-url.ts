/**
 * Catalogue filter state <-> URL. The URL is the source of truth, so every helper here is pure
 * and unknown or malformed values fall back to the defaults instead of throwing.
 */
import { normaliseQuery } from './query';
import { isValidSlug } from './slug';
import { OFFER_TYPES, SORT_KEYS, type CatalogueQuery, type OfferType, type SortKey } from './types';

export const DEFAULT_QUERY: CatalogueQuery = {
  q: '',
  category: null,
  types: [],
  postage: null,
  sort: 'newest',
  page: 1,
};

const MAX_PAGE = 999;

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function parseTypes(value: string | string[] | undefined): OfferType[] {
  const entries = Array.isArray(value) ? value : [value ?? ''];
  const requested = new Set(entries.flatMap((entry) => entry.split(',')).map((e) => e.trim()));
  return OFFER_TYPES.filter((offerType) => requested.has(offerType));
}

function parseSort(value: string): SortKey {
  return SORT_KEYS.find((key) => key === value) ?? DEFAULT_QUERY.sort;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = firstValue(value).trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_QUERY.page;
  const page = Number.parseInt(raw, 10);
  return page >= 1 ? Math.min(page, MAX_PAGE) : DEFAULT_QUERY.page;
}

export function parseCatalogueParams(params: RawParams): CatalogueQuery {
  const category = firstValue(params.category).trim();

  return {
    q: normaliseQuery(firstValue(params.q)),
    // Any well-formed slug: whether it names a real category is the data source's call.
    category: isValidSlug(category) ? category : null,
    types: parseTypes(params.type),
    postage: firstValue(params.postage).trim() === 'free' ? 'free' : null,
    sort: parseSort(firstValue(params.sort).trim()),
    page: parsePage(params.page),
  };
}

export function toCatalogueHref(
  query: Partial<CatalogueQuery>,
  basePath: string = '/freebies'
): string {
  const merged: CatalogueQuery = { ...DEFAULT_QUERY, ...query };
  const search = new URLSearchParams();

  if (merged.q !== DEFAULT_QUERY.q) search.set('q', merged.q);
  if (merged.category !== DEFAULT_QUERY.category) search.set('category', merged.category ?? '');
  if (merged.types.length > 0) search.set('type', merged.types.join(','));
  if (merged.postage !== DEFAULT_QUERY.postage) search.set('postage', merged.postage ?? '');
  if (merged.sort !== DEFAULT_QUERY.sort) search.set('sort', merged.sort);
  if (merged.page !== DEFAULT_QUERY.page) search.set('page', String(merged.page));

  const queryString = search.toString();
  return queryString === '' ? basePath : `${basePath}?${queryString}`;
}

/** Applies a patch to the current query; any change other than `page` sends the visitor to page 1. */
export function withQuery(current: CatalogueQuery, patch: Partial<CatalogueQuery>): CatalogueQuery {
  const next: CatalogueQuery = { ...current, ...patch };
  const filtersChanged = (Object.keys(patch) as (keyof CatalogueQuery)[]).some(
    (key) => key !== 'page' && JSON.stringify(patch[key]) !== JSON.stringify(current[key])
  );
  return filtersChanged ? { ...next, page: 1 } : next;
}
