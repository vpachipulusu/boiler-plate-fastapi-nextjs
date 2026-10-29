import { Skeleton } from '@/components/ui/skeleton';
import { getCategories, getMerchants, searchOffers, type CatalogueQuery } from '@/lib/catalogue';
import { drawerFilterCount } from './catalogue-links';
import { CatalogueEmptyState } from './catalogue-empty-state';
import { CataloguePagination } from './catalogue-pagination';
import { DrawerFilters } from './drawer-filters';
import { FilterDrawer } from './filter-drawer';
import { OfferGrid } from './offer-card';
import { SortSelect } from './sort-select';

export interface CatalogueResultsProps {
  query: CatalogueQuery;
  /** Set on a category page; the category is part of the path rather than the query string. */
  scopeCategory?: string;
}

function countLabel(total: number): string {
  return `${total} ${total === 1 ? 'freebie' : 'freebies'} in this collection`;
}

/** Results column: heading, live count, sort and filter controls, grid (or empty state), pagination. */
export async function CatalogueResults({ query, scopeCategory }: CatalogueResultsProps) {
  const [page, merchants, categories] = await Promise.all([
    searchOffers(query),
    getMerchants(),
    getCategories(),
  ]);
  const category = categories.find((entry) => entry.slug === query.category);

  return (
    <section aria-labelledby="catalogue-results-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="catalogue-results-heading"
            className="font-display text-2xl font-extrabold tracking-tight text-foreground"
          >
            {category?.name ?? 'All freebies'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{countLabel(page.total)}</p>
        </div>
        <FilterDrawer activeCount={drawerFilterCount(query)}>
          <DrawerFilters query={query} scopeCategory={scopeCategory} />
        </FilterDrawer>
        <SortSelect query={query} scopeCategory={scopeCategory} className="hidden lg:flex" />
      </div>

      <div className="mt-6">
        {page.total === 0 ? (
          <CatalogueEmptyState
            query={query}
            categories={categories}
            scopeCategory={scopeCategory}
          />
        ) : (
          <>
            <OfferGrid offers={page.items} merchants={merchants} className="xl:grid-cols-3" />
            <div className="mt-10">
              <CataloguePagination page={page} query={query} scopeCategory={scopeCategory} />
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Sample listings for the design preview. Availability can change quickly, so always read the
        provider’s terms.
      </p>
    </section>
  );
}

const SKELETON_CARDS = 6;

/** Fallback while results load: same heading row and grid so nothing jumps. */
export function CatalogueResultsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading freebies">
      <span className="sr-only">Loading freebies</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
      <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <li key={index}>
            <Skeleton className="aspect-[4/3] w-full rounded-card" />
            <Skeleton className="mt-4 h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
