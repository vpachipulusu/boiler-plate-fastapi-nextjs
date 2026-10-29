import Link from 'next/link';
import { Check } from 'lucide-react';
import type { CatalogueQuery, Category } from '@/lib/catalogue';
import { catalogueHref } from './catalogue-links';
import { FilterHeading, OptionLink, PostageOption, TypeOptions } from './filter-options';

interface FilterSidebarProps {
  query: CatalogueQuery;
  categories: Category[];
  /** Set on a category page: the category control is replaced by a link to the full filter set. */
  scopeCategory?: string;
}

/**
 * Desktop filters (design screen 02), shown from 1024px. Every control is a link built from the
 * current query, so the URL stays the single source of truth.
 */
export function FilterSidebar({ query, categories, scopeCategory }: FilterSidebarProps) {
  return (
    <aside
      aria-labelledby="filter-heading"
      className="hidden rounded-card border border-border bg-card p-4 shadow-sm lg:block"
    >
      <h2
        id="filter-heading"
        className="border-b border-border px-3 pb-4 pt-2 font-display text-lg font-bold text-foreground"
      >
        Filter freebies
      </h2>

      <section aria-labelledby="filter-categories" className="border-b border-border py-4">
        <FilterHeading>
          <span id="filter-categories">Categories</span>
        </FilterHeading>
        {scopeCategory ? (
          <p className="mt-2 px-3 text-sm text-muted-foreground">
            You are browsing one category.{' '}
            <Link
              href={`/freebies?category=${scopeCategory}#categories`}
              className="font-bold text-accent-ink underline-offset-2 hover:underline"
            >
              Switch category
            </Link>
          </p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            <li>
              <OptionLink
                kind="radio"
                selected={query.category === null}
                href={catalogueHref(query, { category: null })}
              >
                All freebies
              </OptionLink>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <OptionLink
                  kind="radio"
                  selected={query.category === category.slug}
                  href={catalogueHref(query, { category: category.slug })}
                >
                  {category.name}
                </OptionLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="filter-types" className="border-b border-border py-4">
        <FilterHeading>
          <span id="filter-types">Offer type</span>
        </FilterHeading>
        <div className="mt-2">
          <TypeOptions query={query} scopeCategory={scopeCategory} />
        </div>
      </section>

      <section aria-labelledby="filter-availability" className="py-4">
        <FilterHeading>
          <span id="filter-availability">Availability</span>
        </FilterHeading>
        <div className="mt-2">
          <PostageOption query={query} scopeCategory={scopeCategory} />
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-input bg-accent p-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-accent-ink"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <p className="text-xs leading-snug text-muted-foreground">
          <span className="block text-sm font-bold text-accent-ink">Terms on every listing</span>
          Postage, eligibility and card needs, in plain words.
        </p>
      </div>
    </aside>
  );
}
