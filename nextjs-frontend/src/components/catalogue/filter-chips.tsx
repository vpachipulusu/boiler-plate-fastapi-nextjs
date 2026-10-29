import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CatalogueQuery, Category } from '@/lib/catalogue';
import { catalogueHref } from './catalogue-links';

const CHIP_CLASS =
  'inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-sm font-semibold transition-colors';

function chipClass(selected: boolean): string {
  return cn(
    CHIP_CLASS,
    selected
      ? 'border-accent-ink bg-accent text-accent-ink'
      : 'border-border bg-card text-foreground hover:bg-muted'
  );
}

interface FilterChipsProps {
  query: CatalogueQuery;
  categories: Category[];
  /** Set on a category page: one link to the full filter set replaces the category chips. */
  scopeCategory?: string;
  className?: string;
}

/**
 * Phone and tablet category chips (design screen 06), hidden from 1024px where the sidebar takes
 * over. A horizontally scrolling row of links; the active chip is a mint pill.
 */
export function FilterChips({ query, categories, scopeCategory, className }: FilterChipsProps) {
  return (
    <nav aria-label="Categories" className={cn('lg:hidden', className)}>
      <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {scopeCategory ? (
          <li>
            <Link
              href={`/freebies?category=${scopeCategory}#categories`}
              className={chipClass(false)}
            >
              Switch category
            </Link>
          </li>
        ) : (
          <>
            <li>
              <Link
                href={catalogueHref(query, { category: null })}
                scroll={false}
                aria-current={query.category === null ? 'true' : undefined}
                className={chipClass(query.category === null)}
              >
                All freebies
              </Link>
            </li>
            {categories.map((category) => {
              const selected = query.category === category.slug;
              return (
                <li key={category.slug}>
                  <Link
                    href={catalogueHref(query, { category: category.slug })}
                    scroll={false}
                    aria-current={selected ? 'true' : undefined}
                    className={chipClass(selected)}
                  >
                    {category.shortName}
                  </Link>
                </li>
              );
            })}
          </>
        )}
      </ul>
    </nav>
  );
}
