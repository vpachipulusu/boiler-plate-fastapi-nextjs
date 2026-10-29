import type { Metadata } from 'next';
import { CatalogueHeader } from '@/components/catalogue/catalogue-header';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { getCatalogueSource, parseCatalogueParams } from '@/lib/catalogue';
import { isCatalogueApiBacked, isRefinedQuery } from '@/lib/seo/indexing';
import { listingRobots, openGraphFor } from '@/lib/seo/metadata';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Rendered per request: the query string drives the page, and an outage is never baked in. */
export const dynamic = 'force-dynamic';

const OG_TITLE = 'All freebies';
const DESCRIPTION =
  'Browse free samples, trials and lovely surprises from UK brands, with terms, postage and card needs set out on every listing.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const query = parseCatalogueParams(await searchParams);
  const title = query.q === '' ? 'All freebies' : `Search: ${query.q}`;
  // Page 1 with no filter or search is the one indexable view, and only when API-backed. Every
  // other view is noindex but followable; all canonicalise to /freebies. An outage does not change
  // this: the page keeps its normal robots while it shows the error (see freejoy-seo.md).
  const indexable = isCatalogueApiBacked(await getCatalogueSource());
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: '/freebies' },
    openGraph: openGraphFor({ title: OG_TITLE, description: DESCRIPTION, path: '/freebies' }),
    robots: listingRobots({ indexable, refined: isRefinedQuery(query) }),
  };
}

export default async function FreebiesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseCatalogueParams(await searchParams);
  const demo = (await getCatalogueSource()) === 'fixture';

  return (
    <>
      <CatalogueHeader query={query} demo={demo} />
      <CatalogueLayout query={query} />
    </>
  );
}
