import type { Metadata } from 'next';
import { CatalogueHeader } from '@/components/catalogue/catalogue-header';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { getLiveOffers, parseCatalogueParams } from '@/lib/catalogue';
import { isCatalogueApiBacked, isRefinedQuery } from '@/lib/seo/indexing';
import { listingRobots, openGraphFor } from '@/lib/seo/metadata';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  'Browse free samples, trials and lovely surprises from UK brands, with terms, postage and card needs set out on every listing.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const query = parseCatalogueParams(await searchParams);
  const title = query.q === '' ? 'All freebies' : `Search: ${query.q}`;
  // Page 1 with no filter or search is the one indexable view, and only once the catalogue is
  // API-backed. Every other view is noindex but followable; all canonicalise to /freebies.
  const indexable = isCatalogueApiBacked(await getLiveOffers());
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: '/freebies' },
    openGraph: openGraphFor({ title, description: DESCRIPTION, path: '/freebies' }),
    robots: listingRobots({ indexable, refined: isRefinedQuery(query) }),
  };
}

export default async function FreebiesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseCatalogueParams(await searchParams);

  return (
    <>
      <CatalogueHeader query={query} />
      <CatalogueLayout query={query} />
    </>
  );
}
