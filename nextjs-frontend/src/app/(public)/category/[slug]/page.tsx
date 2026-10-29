import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogueLayout } from '@/components/catalogue/catalogue-layout';
import { categoryPath } from '@/components/catalogue/catalogue-links';
import { CategoryIntro } from '@/components/catalogue/category-intro';
import {
  DEFAULT_QUERY,
  getCategories,
  getCategoryBySlug,
  parseCatalogueParams,
  searchOffers,
} from '@/lib/catalogue';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: 'Category not found', robots: { index: false } };

  const title = `${category.name} freebies in the UK`;
  return {
    title,
    description: category.description,
    alternates: { canonical: categoryPath(slug) },
    openGraph: { title, description: category.description, url: categoryPath(slug) },
    // Fixture-backed until the catalogue API replaces it.
    robots: { index: false },
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
    </>
  );
}
