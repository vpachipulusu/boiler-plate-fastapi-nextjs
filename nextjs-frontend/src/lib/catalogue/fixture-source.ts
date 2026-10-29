/**
 * Fixture-backed catalogue: the design preview and the unit tests. Selected with
 * `CATALOGUE_SOURCE=fixture` (see `source.ts`). Nothing here touches the network.
 */
import { CATEGORIES, FIXTURE_TODAY, MERCHANTS, OFFERS } from './fixtures';
import { filterOffers, isLive, paginate, relatedOffers, sortOffers } from './query';
import type { CatalogueBackend, OfferLookup } from './source';

async function lookupOffer(slug: string): Promise<OfferLookup> {
  const offer = OFFERS.find((entry) => entry.slug === slug);
  // Returns expired offers too so the detail page can show the ended state; hides draft/archived.
  if (!offer || (offer.status !== 'published' && offer.status !== 'expired')) {
    return { kind: 'not_found' };
  }
  return { kind: 'found', offer };
}

async function getLiveOffers() {
  return sortOffers(
    OFFERS.filter((offer) => isLive(offer, FIXTURE_TODAY)),
    'newest'
  );
}

export const fixtureSource: CatalogueBackend = {
  async getToday() {
    return FIXTURE_TODAY;
  },
  async getCategories() {
    return CATEGORIES.filter((category) => category.enabled)
      .map((category) => ({ ...category }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async getCategoryBySlug(slug) {
    const category = CATEGORIES.find((entry) => entry.slug === slug && entry.enabled);
    return category ? { ...category } : null;
  },
  async getMerchants() {
    return MERCHANTS.map((merchant) => ({ ...merchant }));
  },
  async getMerchantBySlug(slug) {
    const merchant = MERCHANTS.find((entry) => entry.slug === slug);
    return merchant ? { ...merchant } : null;
  },
  lookupOffer,
  getLiveOffers,
  async getFeaturedOffers(limit) {
    const live = await getLiveOffers();
    return live.filter((offer) => offer.featured).slice(0, Math.max(0, limit));
  },
  async searchOffers(rawQuery) {
    // An unknown category in the URL is ignored, as it always was for fixtures.
    const known = CATEGORIES.some((entry) => entry.slug === rawQuery.category);
    const query = known ? rawQuery : { ...rawQuery, category: null };
    const matches = filterOffers(OFFERS, query, {
      today: FIXTURE_TODAY,
      merchants: MERCHANTS,
      categories: CATEGORIES,
    });
    return paginate(sortOffers(matches, query.sort), query.page);
  },
  async getRelatedOffers(offer, limit) {
    return relatedOffers(offer, OFFERS, FIXTURE_TODAY, limit);
  },
};
