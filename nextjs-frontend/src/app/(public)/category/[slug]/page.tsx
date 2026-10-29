import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { categoryPath } from '@/components/catalogue/catalogue-links';
import { CategoryIntro } from '@/components/catalogue/category-intro';
import { CatalogueUnavailablePage } from '@/components/catalogue/inline-error';
import { JsonLd } from '@/components/seo/json-ld';
import {
  DEFAULT_QUERY,
  getCatalogueSource,
  getCategoryBySlug,
  parseCatalogueParams,
  searchOffers,
  settle,
} from '@/lib/catalogue';
import { isIndexableCategory, isRefinedQuery } from '@/lib/seo/indexing';
import { buildBreadcrumbList } from '@/lib/seo/json-ld';
import { NOINDEX_ROBOTS, listingRobots, openGraphFor } from '@/lib/seo/metadata';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Rendered per request: the query string drives the page, and an outage is never baked in. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await settle(getCategoryBySlug(slug));
  if (!loaded.ok) return { title: 'Freebies unavailable', robots: NOINDEX_ROBOTS };
  const category = loaded.data;
  // Thrown here as well as in the page. The root loading.tsx still streams the shell first, so an
  // unknown slug renders the 404 page with HTTP 200 (verified on the production build; see
  // docs/developer/freejoy-seo.md, follow-up 4).
  if (!category) notFound();

  const title = `${category.name} freebies in the UK`;
  const query = parseCatalogueParams((await searchParams) ?? {});
  // The page also reads this (memoised); when that read fails the page shows an error and stays out of search.
  const [source, everything] = await Promise.all([
    getCatalogueSource(),
    settle(searchOffers({ ...DEFAULT_QUERY, category: category.slug })),
  ]);
  const indexable = isIndexableCategory(category, source) && everything.ok;
  return {
    title,
    description: category.description,
    alternates: { canonical: categoryPath(slug) },
    openGraph: openGraphFor({
      title,
      description: category.description,
      path: categoryPath(slug),
    }),
    // Filters, search, sort and page 2+ are noindex but followable; the category itself follows
    // the data source (noindex while fixture-backed).
    robots: listingRobots({ indexable, refined: isRefinedQuery(query) }),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const loaded = await settle(getCategoryBySlug(slug));
  if (!loaded.ok) return <CatalogueUnavailablePage />;
  const category = loaded.data;
  if (!category) notFound();

  const query = { ...parseCatalogueParams(await searchParams), category: category.slug };
  const everything = await settle(searchOffers({ ...DEFAULT_QUERY, category: category.slug }));
  if (!everything.ok) return <CatalogueUnavailablePage heading={`${category.name} freebies`} />;

  return (
    <>
      <CategoryIntro category={category} total={everything.data.total} />
      <CatalogueLayout query={query} scopeCategory={category.slug} />
      <JsonLd
        data={buildBreadcrumbList([
          { name: 'Home', path: '/' },
          { name: category.name, path: categoryPath(category.slug) },
        ])}
      />
    </>
  );
}
