import type { MetadataRoute } from 'next';
import { getCategories, getLiveOffers, getToday } from '@/lib/catalogue';
import { buildSitemapEntries } from '@/lib/seo/sitemap';

/** Rebuilt at most hourly so an offer that has just expired drops out without a deploy. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [offers, categories, today] = await Promise.all([
    getLiveOffers(),
    getCategories(),
    getToday(),
  ]);
  return buildSitemapEntries({ offers, categories, today });
}
