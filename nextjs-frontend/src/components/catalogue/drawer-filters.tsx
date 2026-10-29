import Link from 'next/link';
import type { CatalogueQuery } from '@/lib/catalogue';
import { catalogueBasePath } from './catalogue-links';
import { FilterHeading, PostageOption, SortOptions, TypeOptions } from './filter-options';

interface DrawerFiltersProps {
  query: CatalogueQuery;
  scopeCategory?: string;
}

/**
 * The controls inside the phone filter drawer: offer type, postage, sort and "Clear filters". They
 * are rendered on the server as links and passed to the client drawer as children.
 */
export function DrawerFilters({ query, scopeCategory }: DrawerFiltersProps) {
  return (
    <div className="space-y-5">
      <section aria-labelledby="drawer-types">
        <FilterHeading>
          <span id="drawer-types">Offer type</span>
        </FilterHeading>
        <div className="mt-2">
          <TypeOptions query={query} scopeCategory={scopeCategory} />
        </div>
      </section>
      <section aria-labelledby="drawer-availability">
        <FilterHeading>
          <span id="drawer-availability">Availability</span>
        </FilterHeading>
        <div className="mt-2">
          <PostageOption query={query} scopeCategory={scopeCategory} />
        </div>
      </section>
      <section aria-labelledby="drawer-sort">
        <FilterHeading>
          <span id="drawer-sort">Sort by</span>
        </FilterHeading>
        <div className="mt-2">
          <SortOptions query={query} scopeCategory={scopeCategory} />
        </div>
      </section>
      <Link
        href={catalogueBasePath(scopeCategory)}
        className="flex min-h-11 items-center justify-center rounded-pill border border-border px-5 text-sm font-bold text-foreground hover:bg-muted"
      >
        Clear filters
      </Link>
    </div>
  );
}
