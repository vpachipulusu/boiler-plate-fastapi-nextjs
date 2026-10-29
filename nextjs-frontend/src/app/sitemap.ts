import type { MetadataRoute } from 'next';
import { getCategories, getToday } from '@/lib/catalogue';
import { loadLiveOffersForSeo } from '@/lib/seo/live-offers';
import { buildSitemapEntries } from '@/lib/seo/sitemap';

/** Rebuilt at most hourly so an offer that has just expired drops out without a deploy. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A failed catalogue read gives no offers, so only the static pages are listed (fail secure).
  const [offers, categories, today] = await Promise.all([
    loadLiveOffersForSeo('sitemap'),
    getCategories(),
    getToday(),
  ]);
  return buildSitemapEntries({ offers, categories, today });
}
