import type { Metadata } from 'next';
import { CategoryGrid } from '@/components/home/category-grid';
import { FreshlyFound } from '@/components/home/freshly-found';
import { HomeHero } from '@/components/home/home-hero';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { TrustStrip } from '@/components/home/trust-strip';
import { JsonLd } from '@/components/seo/json-ld';
import { getCategories, getFeaturedOffers, getMerchants } from '@/lib/catalogue';
import { isCatalogueApiBacked } from '@/lib/seo/indexing';
import { buildOrganization, buildWebSite } from '@/lib/seo/json-ld';
import { loadLiveOffersForSeo } from '@/lib/seo/live-offers';
import { listingRobots, openGraphFor } from '@/lib/seo/metadata';

/** Re-rendered at most hourly so the featured offers and the indexing state track the catalogue. */
export const revalidate = 3600;

const TITLE = 'Freejoy – UK freebies, samples and offers';
const DESCRIPTION =
  'Browse UK freebies, samples, trials and offers, with terms, postage and card requirements set out on every listing.';

export async function generateMetadata(): Promise<Metadata> {
  // Indexable only once the catalogue is API-backed; the fixture preview stays out of search.
  const indexable = isCatalogueApiBacked(await loadLiveOffersForSeo('home metadata'));
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/' }),
    robots: listingRobots({ indexable }),
  };
}

export default async function HomePage() {
  const [categories, offers, merchants] = await Promise.all([
    getCategories(),
    getFeaturedOffers(8),
    getMerchants(),
  ]);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 lg:py-8">
      <JsonLd data={[buildWebSite(), buildOrganization()]} />
      <HomeHero />
      <TrustStrip />
      <CategoryGrid categories={categories} />
      <FreshlyFound offers={offers} merchants={merchants} />
      <NewsletterBand />
    </div>
  );
}
