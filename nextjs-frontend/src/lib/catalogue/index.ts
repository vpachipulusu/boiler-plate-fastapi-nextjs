/**
 * Catalogue facade. Pages import from here only. Every function is async so Phase 2 can swap the
 * fixtures for the catalogue API without changing a single call site.
 */
import { CATEGORIES, FIXTURE_TODAY, MERCHANTS, OFFERS } from './fixtures';
import { filterOffers, isLive, paginate, relatedOffers, sortOffers } from './query';
import type { CatalogueQuery, Category, Merchant, Offer, Page } from './types';

export * from './types';
export { DEFAULT_QUERY, parseCatalogueParams, toCatalogueHref, withQuery } from './offer-url';
export { isLive, normaliseQuery } from './query';

export async function getToday(): Promise<string> {
  return FIXTURE_TODAY;
}

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES.filter((category) => category.enabled)
    .map((category) => ({ ...category }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const category = CATEGORIES.find((entry) => entry.slug === slug && entry.enabled);
  return category ? { ...category } : null;
}

export async function getMerchants(): Promise<Merchant[]> {
  return MERCHANTS.map((merchant) => ({ ...merchant }));
}

export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const merchant = MERCHANTS.find((entry) => entry.slug === slug);
  return merchant ? { ...merchant } : null;
}

/** Returns expired offers too so the detail page can show the ended state; hides draft/archived. */
export async function getOfferBySlug(slug: string): Promise<Offer | null> {
  const offer = OFFERS.find((entry) => entry.slug === slug);
  if (!offer || (offer.status !== 'published' && offer.status !== 'expired')) return null;
  return offer;
}

export async function getLiveOffers(): Promise<Offer[]> {
  return sortOffers(
    OFFERS.filter((offer) => isLive(offer, FIXTURE_TODAY)),
    'newest'
  );
}

export async function getFeaturedOffers(limit = 8): Promise<Offer[]> {
  const live = await getLiveOffers();
  return live.filter((offer) => offer.featured).slice(0, Math.max(0, limit));
}

export async function searchOffers(query: CatalogueQuery): Promise<Page<Offer>> {
  const matches = filterOffers(OFFERS, query, {
    today: FIXTURE_TODAY,
    merchants: MERCHANTS,
    categories: CATEGORIES,
  });
  return paginate(sortOffers(matches, query.sort), query.page);
}

export async function getRelatedOffers(offer: Offer, limit = 4): Promise<Offer[]> {
  return relatedOffers(offer, OFFERS, FIXTURE_TODAY, limit);
}
