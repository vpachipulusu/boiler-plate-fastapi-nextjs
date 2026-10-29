import type { MetadataRoute } from 'next';
import { getCatalogueSource, getToday } from '@/lib/catalogue';
import { loadCategoriesForSeo, loadLiveOffersForSeo } from '@/lib/seo/live-offers';
import { buildSitemapEntries } from '@/lib/seo/sitemap';

/**
 * Rendered per request. The catalogue reads behind it are cached for a minute, so an offer that has
 * just expired drops out within that time, and an outage is never baked into a prerendered sitemap.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A failed catalogue read gives no offers or categories, so only the static pages are listed
  // (fail secure).
  const [offers, categories, today, source] = await Promise.all([
    loadLiveOffersForSeo('sitemap'),
    loadCategoriesForSeo('sitemap'),
    getToday(),
    getCatalogueSource(),
  ]);
  return buildSitemapEntries({ offers, categories, today, source });
}
