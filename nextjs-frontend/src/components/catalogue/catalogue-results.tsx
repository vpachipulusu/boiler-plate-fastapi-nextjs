import { Skeleton } from '@/components/ui/skeleton';
import { getCategories, getMerchants, searchOffers, type CatalogueQuery } from '@/lib/catalogue';
import { CatalogueEmptyState } from './catalogue-empty-state';
import { CataloguePagination } from './catalogue-pagination';
import { OfferGrid } from './offer-card';

export interface CatalogueResultsProps {
  query: CatalogueQuery;
  /** Set on a category page; the category is part of the path rather than the query string. */
  scopeCategory?: string;
}

function countLabel(total: number): string {
  return `${total} ${total === 1 ? 'freebie' : 'freebies'} in this collection`;
}

/**
 * Heading and live count for the results column. Rendered in its own Suspense boundary so the
 * filter and sort controls next to it stay mounted (and keep focus) while results stream in.
 */
export async function CatalogueHeading({ query }: Pick<CatalogueResultsProps, 'query'>) {
  const [page, categories] = await Promise.all([searchOffers(query), getCategories()]);
  const category = categories.find((entry) => entry.slug === query.category);

  return (
    <div className="min-w-0">
      <h2
        id="catalogue-results-heading"
        className="font-display text-2xl font-extrabold tracking-tight text-foreground"
      >
        {category?.name ?? 'All freebies'}
      </h2>
      <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
        {countLabel(page.total)}
      </p>
    </div>
  );
}

/** Results column body: grid (or empty state), pagination and the demo note. */
export async function CatalogueResults({ query, scopeCategory }: CatalogueResultsProps) {
  const [page, merchants, categories] = await Promise.all([
    searchOffers(query),
    getMerchants(),
    getCategories(),
  ]);

  return (
    <div>
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
    </div>
  );
}

const SKELETON_CARDS = 6;

/** Fallback for the heading row while the count loads. */
export function CatalogueHeadingSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
    </div>
  );
}

/** Fallback while results load: same grid shape so nothing jumps. */
export function CatalogueResultsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading freebies">
      <span className="sr-only">Loading freebies</span>
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
