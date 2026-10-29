import { getCategories, getLiveOffers } from '@/lib/catalogue';
import type { Category, Offer } from '@/lib/catalogue/types';
import { logger } from '@/lib/logger';

/**
 * Reads the live offers for an indexing decision. If the catalogue read fails it logs and returns
 * an empty list, which is the fail-secure answer: the sitemap holds only its static pages. Sitemap
 * generation therefore never throws because the catalogue is down.
 */
export async function loadLiveOffersForSeo(context: string): Promise<Offer[]> {
  try {
    return await getLiveOffers();
  } catch (error) {
    logger.error('SEO: could not read live offers; falling back to noindex', {
      context,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return [];
  }
}

/** Same fail-secure read for the category list the sitemap names. */
export async function loadCategoriesForSeo(context: string): Promise<Category[]> {
  try {
    return await getCategories();
  } catch (error) {
    logger.error('SEO: could not read categories; falling back to the static pages', {
      context,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return [];
  }
}
