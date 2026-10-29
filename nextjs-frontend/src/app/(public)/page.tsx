import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HomeHero } from '@/components/home/home-hero';
import { HomeSections, HomeSectionsSkeleton } from '@/components/home/home-sections';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { TrustStrip } from '@/components/home/trust-strip';
import { JsonLd } from '@/components/seo/json-ld';
import { getCatalogueSource } from '@/lib/catalogue';
import { isCatalogueApiBacked } from '@/lib/seo/indexing';
import { buildOrganization, buildWebSite } from '@/lib/seo/json-ld';
import { listingRobots, openGraphFor } from '@/lib/seo/metadata';

/**
 * Rendered per request. The catalogue reads behind it are cached for a minute, so the page tracks the
 * catalogue closely, and an outage can never be baked into a prerendered page.
 */
export const dynamic = 'force-dynamic';

const TITLE = 'Freejoy – UK freebies, samples and offers';
const DESCRIPTION =
  'Browse UK freebies, samples, trials and offers, with terms, postage and card requirements set out on every listing.';

export async function generateMetadata(): Promise<Metadata> {
  // Indexable only when API-backed. An outage does not change this: the page keeps its normal robots
  // while it shows the error (see freejoy-seo.md).
  const indexable = isCatalogueApiBacked(await getCatalogueSource());
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/' }),
    robots: listingRobots({ indexable }),
  };
}

export default async function HomePage() {
  const demo = (await getCatalogueSource()) === 'fixture';

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 lg:py-8">
      <JsonLd data={[buildWebSite(), buildOrganization()]} />
      <HomeHero demo={demo} />
      <TrustStrip demo={demo} />
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections demo={demo} />
      </Suspense>
      <NewsletterBand />
    </div>
  );
}
