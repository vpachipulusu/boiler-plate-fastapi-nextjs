import Link from 'next/link';
import { Spark } from '@/components/site/brand-mark';
import {
  OFFER_TYPE_LABELS,
  toCatalogueHref,
  type CatalogueQuery,
  type Category,
} from '@/lib/catalogue';
import { catalogueBasePath } from './catalogue-links';

interface CatalogueEmptyStateProps {
  query: CatalogueQuery;
  categories: Category[];
  scopeCategory?: string;
}

/** "for "zzzz", Free sample or Free trial offers with no postage" style echo of what was asked. */
function describeRequest(query: CatalogueQuery): string {
  const parts: string[] = [];
  if (query.q !== '') parts.push(`“${query.q}”`);
  if (query.types.length > 0) {
    parts.push(query.types.map((type) => OFFER_TYPE_LABELS[type]).join(' or '));
  }
  if (query.postage === 'free') parts.push('with no postage');
  return parts.join(', ');
}

/** Friendly empty panel: what was asked, a way back and the categories to try instead. */
export function CatalogueEmptyState({
  query,
  categories,
  scopeCategory,
}: CatalogueEmptyStateProps) {
  const request = describeRequest(query);
  return (
    <section
      aria-labelledby="catalogue-empty-heading"
      className="rounded-editorial border border-border bg-card px-6 py-12 text-center shadow-sm"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-cta">
        <Spark className="h-7 w-7" />
      </span>
      <h3
        id="catalogue-empty-heading"
        className="mt-5 font-display text-2xl font-extrabold text-foreground"
      >
        No freebies match that yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {request !== ''
          ? `We could not find anything for ${request}. Try a different word or clear the filters.`
          : 'There is nothing here right now. New finds are added regularly.'}
      </p>
      <Link
        href={catalogueBasePath(scopeCategory)}
        className="mt-6 inline-flex min-h-11 items-center rounded-pill bg-cta px-6 text-sm font-bold text-cta-foreground transition-colors hover:bg-cta-hover"
      >
        Clear filters
      </Link>
      {!scopeCategory && (
        <>
          <p className="mt-8 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Or browse a category
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={toCatalogueHref({ category: category.slug })}
                  className="inline-flex min-h-11 items-center rounded-pill border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
