import { Suspense } from 'react';
import { getCategories } from '@/lib/catalogue';
import {
  CatalogueResults,
  CatalogueResultsSkeleton,
  type CatalogueResultsProps,
} from './catalogue-results';
import { FilterChips } from './filter-chips';
import { FilterSidebar } from './filter-sidebar';

/**
 * The two-column catalogue layout shared by /freebies and /category/[slug]: filters on the left
 * from 1024px (chips and a drawer below), results streamed in a Suspense boundary keyed by the
 * serialised query. `id="categories"` is the target of the header's "Categories" links.
 */
export async function CatalogueLayout({ query, scopeCategory }: CatalogueResultsProps) {
  const categories = await getCategories();
  const key = `${scopeCategory ?? ''}|${JSON.stringify(query)}`;

  return (
    <div className="mx-auto max-w-content px-4 pb-16 pt-8 sm:px-6 lg:grid lg:grid-cols-[268px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div id={scopeCategory ? undefined : 'categories'} className="scroll-mt-24">
        <FilterChips
          query={query}
          categories={categories}
          scopeCategory={scopeCategory}
          className="mb-6"
        />
        <FilterSidebar query={query} categories={categories} scopeCategory={scopeCategory} />
      </div>
      <Suspense key={key} fallback={<CatalogueResultsSkeleton />}>
        <CatalogueResults query={query} scopeCategory={scopeCategory} />
      </Suspense>
    </div>
  );
}
