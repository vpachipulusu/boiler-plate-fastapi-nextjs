import type { Metadata } from 'next';
import { CatalogueHeader } from '@/components/catalogue/catalogue-header';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { hasActiveRefinement } from '@/components/catalogue/catalogue-links';
import { parseCatalogueParams } from '@/lib/catalogue';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  'Browse free samples, trials and lovely surprises from UK brands. Every offer is checked, with the real terms spelled out.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const query = parseCatalogueParams(await searchParams);
  return {
    title: query.q === '' ? 'All freebies' : `Search: ${query.q}`,
    description: DESCRIPTION,
    alternates: { canonical: '/freebies' },
    // Filtered, searched and paged views duplicate the main listing, so keep them out of search.
    robots: hasActiveRefinement(query) ? { index: false } : undefined,
  };
}

export default async function FreebiesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseCatalogueParams(await searchParams);

  return (
    <>
      <CatalogueHeader q={query.q} />
      <CatalogueLayout query={query} />
    </>
  );
}
