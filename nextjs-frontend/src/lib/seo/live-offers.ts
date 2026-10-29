import { getLiveOffers } from '@/lib/catalogue';
import type { Offer } from '@/lib/catalogue/types';
import { logger } from '@/lib/logger';

/**
 * Reads the live offers for an indexing decision. If the catalogue read fails it logs and returns
 * an empty list, which is the fail-secure answer: nothing is API-backed, so listing pages are
 * `noindex` and the sitemap holds only its static pages. Metadata and sitemap generation therefore
 * never throw because the catalogue is down.
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
