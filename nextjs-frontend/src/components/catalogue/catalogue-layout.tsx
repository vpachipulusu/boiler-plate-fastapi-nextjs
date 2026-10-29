import { Suspense } from 'react';
import { getCategories } from '@/lib/catalogue';
import { drawerFilterCount } from './catalogue-links';
import {
  CatalogueHeading,
  CatalogueHeadingSkeleton,
  CatalogueResults,
  CatalogueResultsSkeleton,
  type CatalogueResultsProps,
} from './catalogue-results';
import { DrawerFilters } from './drawer-filters';
import { FilterChips } from './filter-chips';
import { FilterDrawer } from './filter-drawer';
import { FilterSidebar } from './filter-sidebar';
import { SortSelect } from './sort-select';

/**
 * The two-column catalogue layout shared by /freebies and /category/[slug]: filters on the left
 * from 1024px (chips and a drawer below), results streamed in Suspense boundaries keyed by the
 * serialised query. The filter drawer and sort control sit outside those boundaries so they keep
 * their DOM (and focus) across navigations. `id="categories"` is the target of the header's
 * "Categories" links.
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
      <section aria-labelledby="catalogue-results-heading">
        <div className="flex items-start justify-between gap-4">
          <Suspense key={key} fallback={<CatalogueHeadingSkeleton />}>
            <CatalogueHeading query={query} />
          </Suspense>
          <FilterDrawer activeCount={drawerFilterCount(query)}>
            <DrawerFilters query={query} scopeCategory={scopeCategory} />
          </FilterDrawer>
          <SortSelect query={query} scopeCategory={scopeCategory} className="hidden lg:flex" />
        </div>
        <Suspense key={key} fallback={<CatalogueResultsSkeleton />}>
          <CatalogueResults query={query} scopeCategory={scopeCategory} />
        </Suspense>
      </section>
    </div>
  );
}
