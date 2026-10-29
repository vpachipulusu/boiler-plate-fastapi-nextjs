/**
 * Pure catalogue query helpers. Nothing here reads the wall clock: callers pass `today` in so
 * server renders, tests and the Phase 2 API adapter all agree on what "expired" means.
 */
import {
  CATALOGUE_PAGE_SIZE,
  type CatalogueQuery,
  type Category,
  type Merchant,
  type Offer,
  type Page,
  type SortKey,
} from './types';

const MAX_QUERY_LENGTH = 80;

export interface FilterOptions {
  /** ISO date (YYYY-MM-DD) used for every expiry comparison. */
  today: string;
  /** Keep offers whose status is `expired` (draft and archived are still excluded). */
  includeExpired?: boolean;
  /** Merchants used to match the search text against merchant names. */
  merchants?: readonly Merchant[];
  /** Categories used to match the search text against category names. */
  categories?: readonly Category[];
}

/** Trims, collapses runs of whitespace and caps the search text at 80 characters. */
export function normaliseQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH).trimEnd();
}

/** A live offer is published and has either no end date or an end date that is not in the past. */
export function isLive(offer: Offer, today: string): boolean {
  return offer.status === 'published' && (offer.endAt === null || offer.endAt >= today);
}

function isVisible(offer: Offer, options: FilterOptions): boolean {
  if (options.includeExpired) {
    return offer.status === 'published' || offer.status === 'expired';
  }
  return isLive(offer, options.today);
}

function buildSearchText(
  offer: Offer,
  merchants: readonly Merchant[],
  categories: readonly Category[]
): string {
  const merchantName = merchants.find((merchant) => merchant.slug === offer.merchantSlug)?.name;
  const categoryName = categories.find((category) => category.slug === offer.categorySlug)?.name;
  return [offer.title, offer.summary, merchantName ?? '', categoryName ?? '']
    .join(' ')
    .toLowerCase();
}

export function filterOffers(
  offers: readonly Offer[],
  query: CatalogueQuery,
  options: FilterOptions
): Offer[] {
  const needle = normaliseQuery(query.q).toLowerCase();
  const merchants = options.merchants ?? [];
  const categories = options.categories ?? [];

  return offers.filter((offer) => {
    if (!isVisible(offer, options)) return false;
    if (query.category !== null && offer.categorySlug !== query.category) return false;
    if (query.types.length > 0 && !query.types.includes(offer.offerType)) return false;
    if (query.postage === 'free' && offer.postage.kind !== 'free') return false;
    if (needle !== '' && !buildSearchText(offer, merchants, categories).includes(needle)) {
      return false;
    }
    return true;
  });
}

function compareTitles(a: Offer, b: Offer): number {
  return a.title.localeCompare(b.title, 'en-GB');
}

/** ISO dates sort correctly as strings, so a plain comparison is enough. */
function compareDatesDescending(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

function compareNewest(a: Offer, b: Offer): number {
  return compareDatesDescending(a.startAt, b.startAt) || compareTitles(a, b);
}

function compareEndingSoon(a: Offer, b: Offer): number {
  if (a.endAt !== null && b.endAt !== null) {
    if (a.endAt !== b.endAt) return a.endAt < b.endAt ? -1 : 1;
    return compareTitles(a, b);
  }
  if (a.endAt !== null) return -1;
  if (b.endAt !== null) return 1;
  return compareNewest(a, b);
}

const COMPARATORS: Record<SortKey, (a: Offer, b: Offer) => number> = {
  newest: compareNewest,
  ending_soon: compareEndingSoon,
  a_z: compareTitles,
};

/** Returns a new, sorted array; the input is never mutated. */
export function sortOffers(offers: readonly Offer[], sort: SortKey): Offer[] {
  return [...offers].sort(COMPARATORS[sort]);
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number = CATALOGUE_PAGE_SIZE
): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const safePage = Math.min(Math.max(1, requested), pageCount);
  const start = (safePage - 1) * size;
  const pageItems = items.slice(start, start + size);

  return {
    items: pageItems,
    page: safePage,
    pageCount,
    total,
    from: pageItems.length === 0 ? 0 : start + 1,
    to: pageItems.length === 0 ? 0 : start + pageItems.length,
  };
}

/** Live offers from the same category (newest first), padded with other live featured offers. */
export function relatedOffers(
  offer: Offer,
  offers: readonly Offer[],
  today: string,
  limit = 4
): Offer[] {
  const others = offers.filter(
    (candidate) => candidate.id !== offer.id && isLive(candidate, today)
  );
  const sameCategory = sortOffers(
    others.filter((candidate) => candidate.categorySlug === offer.categorySlug),
    'newest'
  );
  const padding = sortOffers(
    others.filter(
      (candidate) => candidate.categorySlug !== offer.categorySlug && candidate.featured
    ),
    'newest'
  );
  return [...sameCategory, ...padding].slice(0, Math.max(0, limit));
}
