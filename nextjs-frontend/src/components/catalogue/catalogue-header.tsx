import Link from 'next/link';
import { SearchForm } from '@/components/site/search-form';

interface CatalogueHeaderProps {
  /** Current search text, prefilled in the hero search. */
  q: string;
}

/** Page header for /freebies (design screens 02 and 06): breadcrumb, display heading, copy and search. */
export function CatalogueHeader({ q }: CatalogueHeaderProps) {
  return (
    <header className="mx-auto max-w-content px-4 pt-8 sm:px-6 lg:pt-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
              <li>
                <Link href="/" className="inline-flex min-h-6 items-center hover:underline">
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
            little free thing.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Discover samples, trials and lovely surprises. New finds added regularly.
          </p>
        </div>
        <SearchForm
          key={q}
          variant="hero"
          id="catalogue-search"
          defaultValue={q}
          placeholder="Search offers, brands or categories"
          className="w-full lg:max-w-xl"
        />
      </div>
      <div className="mt-8 border-b border-border lg:mt-10" />
    </header>
  );
}
