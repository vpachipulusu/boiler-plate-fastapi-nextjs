import Link from 'next/link';
import { SearchForm } from '@/components/site/search-form';
import type { CatalogueQuery } from '@/lib/catalogue';

interface CatalogueHeaderProps {
  /** Current query: the search text is prefilled and the active filters ride along as hidden fields. */
  query: CatalogueQuery;
  /** True when the listings are fixtures: the intro says so. */
  demo: boolean;
}

/** Filters a new search must keep, so searching from a filtered view narrows it instead of resetting it. */
function carriedParams(query: CatalogueQuery): [string, string][] {
  const params: [string, string][] = [];
  if (query.category !== null) params.push(['category', query.category]);
  if (query.types.length > 0) params.push(['type', query.types.join(',')]);
  if (query.postage !== null) params.push(['postage', query.postage]);
  if (query.sort !== 'newest') params.push(['sort', query.sort]);
  return params;
}

/** Page header for /freebies (design screens 02 and 06): breadcrumb, display heading, copy and search. */
export function CatalogueHeader({ query, demo }: CatalogueHeaderProps) {
  const q = query.q;
  return (
    <header className="mx-auto max-w-content px-4 pt-8 sm:px-6 lg:pt-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
              <li>
                <Link href="/" className="inline-flex min-h-11 items-center hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">All freebies</li>
            </ol>
          </nav>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[56px]">
            Find your next
            <br />
            little treat.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Discover samples, trials and lovely surprises.
            {demo && ' Sample listings for the design preview.'}
          </p>
        </div>
        <SearchForm
          key={q}
          variant="hero"
          id="catalogue-search"
          defaultValue={q}
          hiddenParams={carriedParams(query)}
          placeholder="Search offers, brands or categories"
          className="w-full lg:max-w-xl"
        />
      </div>
      <div className="mt-8 border-b border-border lg:mt-10" />
    </header>
  );
}
