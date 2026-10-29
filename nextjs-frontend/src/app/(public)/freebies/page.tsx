import type { Metadata } from 'next';
import { CatalogueHeader } from '@/components/catalogue/catalogue-header';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { parseCatalogueParams } from '@/lib/catalogue';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  'Browse free samples, trials and lovely surprises from UK brands, with terms, postage and card needs set out on every listing.';

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
    // Fixture-backed design preview: nothing here is a real offer yet, so keep it out of search.
    robots: { index: false },
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
