import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { categoryPath } from '@/components/catalogue/catalogue-links';
import { CategoryIntro } from '@/components/catalogue/category-intro';
import { JsonLd } from '@/components/seo/json-ld';
import {
  DEFAULT_QUERY,
  getCategories,
  getCategoryBySlug,
  getLiveOffers,
  parseCatalogueParams,
  searchOffers,
} from '@/lib/catalogue';
import { isIndexableCategory, isRefinedQuery } from '@/lib/seo/indexing';
import { buildBreadcrumbList } from '@/lib/seo/json-ld';
import { listingRobots, openGraphFor } from '@/lib/seo/metadata';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  // Thrown here as well as in the page so the 404 status is set before streaming starts.
  if (!category) notFound();

  const title = `${category.name} freebies in the UK`;
  const query = parseCatalogueParams((await searchParams) ?? {});
  const indexable = isIndexableCategory(category, await getLiveOffers());
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
    // the data (noindex while fixture-backed).
    robots: listingRobots({ indexable, refined: isRefinedQuery({ ...query, category: null }) }),
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
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const query = { ...parseCatalogueParams(await searchParams), category: category.slug };
  const everything = await searchOffers({ ...DEFAULT_QUERY, category: category.slug });

  return (
    <>
      <CategoryIntro category={category} total={everything.total} />
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
