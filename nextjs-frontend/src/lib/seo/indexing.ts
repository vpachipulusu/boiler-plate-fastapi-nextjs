/**
 * Indexing policy. Pure functions only: callers pass `today` in and the catalogue data they already
 * read through the facade, so nothing here reads the wall clock or the fixtures.
 *
 * Indexability is decided by where the catalogue comes from and by each offer's own data. Fixture
 * offers carry `source: 'fixture'` and `demo: true`, so every helper answers "not indexable" for them.
 * Offers from the catalogue API (`source: 'api'`, `demo: false`) are indexable while live.
 */
import { isLive } from '@/lib/catalogue/query';
import type { CatalogueSource, EndedOffer } from '@/lib/catalogue/source';
import type { CatalogueQuery, Category, Offer } from '@/lib/catalogue/types';

/** An expired offer stays online (200, noindex) for this many days after `endAt`, then is gone. */
export const EXPIRED_NOINDEX_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/**
 * True when the catalogue is read from the API rather than the fixtures. It says nothing about how
 * many offers are live, so a lull (or launch day with nothing published yet) does not noindex the
 * listing pages. Pass `await getCatalogueSource()`.
 */
export function isCatalogueApiBacked(source: CatalogueSource): boolean {
  return source === 'api';
}

/** A real, published, live offer that came from the catalogue API. Demo and fixture data never is. */
export function isIndexableOffer(offer: Offer, today: string): boolean {
  return (
    offer.source === 'api' && !offer.demo && offer.status === 'published' && isLive(offer, today)
  );
}

/** An enabled category is indexable once the catalogue is API-backed; fixtures keep it noindex. */
export function isIndexableCategory(
  category: Pick<Category, 'enabled'>,
  source: CatalogueSource
): boolean {
  return category.enabled && isCatalogueApiBacked(source);
}

/** True when the query is anything other than the unfiltered, first, default-sorted page. */
export function isRefinedQuery(query: CatalogueQuery): boolean {
  return (
    query.q !== '' ||
    query.category !== null ||
    query.types.length > 0 ||
    query.postage !== null ||
    query.sort !== 'newest' ||
    query.page > 1
  );
}

export type OfferIndexingState = 'live' | 'ended' | 'gone' | 'unavailable';

export interface OfferIndexingPolicy {
  state: OfferIndexingState;
  /**
   * The status the policy intends. Reserved for the Phase 3 410 ticket: no page reads it yet (a
   * `gone` API offer ships as `notFound()`, see docs/developer/freejoy-seo.md).
   */
  httpStatus: 200 | 404 | 410;
  /** True when the policy itself forces `noindex, follow` regardless of the data source. */
  noindex: boolean;
}

function parseIsoDay(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole days from `from` to `to` (both ISO dates); NaN when either is not a date. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDay(to) - parseIsoDay(from)) / MS_PER_DAY);
}

/**
 * What an offer page should do once the offer is no longer live:
 * - live: no policy override (indexability still depends on the data source);
 * - ended: answers 200 with the ended state and `noindex, follow`, for 30 days after `endAt`;
 * - gone: more than 30 days after `endAt`, the page is gone (410);
 * - unavailable: draft or archived offers have no public page (404).
 * An expired offer with no `endAt` has nothing to count from, so it stays `ended`.
 */
export function expiredIndexingPolicy(offer: Offer, today: string): OfferIndexingPolicy {
  if (offer.status === 'draft' || offer.status === 'archived') {
    return { state: 'unavailable', httpStatus: 404, noindex: true };
  }
  if (isLive(offer, today)) return { state: 'live', httpStatus: 200, noindex: false };
  if (offer.endAt !== null && daysBetween(offer.endAt, today) > EXPIRED_NOINDEX_DAYS) {
    return { state: 'gone', httpStatus: 410, noindex: true };
  }
  return { state: 'ended', httpStatus: 200, noindex: true };
}

/**
 * What an offer page does for an offer the catalogue API reports as ended (its 410): `ended` renders
 * the ended state with `noindex, follow` for 30 days after `endedAt`, then `gone` (404 for now, see
 * docs/developer/freejoy-seo.md). With no end date there is nothing to count from, so it stays `ended`.
 */
export function endedOfferState(
  ended: Pick<EndedOffer, 'endedAt'>,
  today: string
): 'ended' | 'gone' {
  if (ended.endedAt !== null && daysBetween(ended.endedAt, today) > EXPIRED_NOINDEX_DAYS) {
    return 'gone';
  }
  return 'ended';
}
