import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogueQuery, Page } from '@/lib/catalogue';
import { catalogueHref } from './catalogue-links';

interface CataloguePaginationProps {
  /** Only the page numbers and the item range are read, so any `Page<T>` works. */
  page: Pick<Page<unknown>, 'page' | 'pageCount' | 'total' | 'from' | 'to'>;
  query: CatalogueQuery;
  scopeCategory?: string;
}

const EDGE_CLASS =
  'inline-flex min-h-11 items-center gap-1 rounded-pill border px-4 text-sm font-bold';

/** First, last and the neighbours of the current page; `null` marks a gap. */
export function pageWindow(current: number, count: number): (number | null)[] {
  const wanted = new Set([1, count, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  return pages.flatMap((n, index) => (index > 0 && n - pages[index - 1] > 1 ? [null, n] : [n]));
}

/**
 * Link-based pagination. Every link keeps the search and filters and changes only `page`, so Back
 * and shared URLs behave. A disabled edge is a span, not a dead link.
 */
export function CataloguePagination({ page, query, scopeCategory }: CataloguePaginationProps) {
  const hrefFor = (target: number) => catalogueHref(query, { page: target }, scopeCategory);
  const hasPrevious = page.page > 1;
  const hasNext = page.page < page.pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between"
    >
      <p className="text-sm tabular-nums text-muted-foreground">
        Showing {page.from}–{page.to} of {page.total}
      </p>
      {page.pageCount > 1 && (
        <ul className="flex flex-wrap items-center justify-center gap-2">
          <li>
            {hasPrevious ? (
              <Link
                href={hrefFor(page.page - 1)}
                rel="prev"
                className={cn(EDGE_CLASS, 'border-border bg-card hover:bg-muted')}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={cn(EDGE_CLASS, 'border-border text-muted-foreground opacity-60')}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </span>
            )}
          </li>
          {pageWindow(page.page, page.pageCount).map((entry, index) =>
            entry === null ? (
              <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
                …
              </li>
            ) : (
              <li key={entry}>
                <Link
                  href={hrefFor(entry)}
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page.page ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-11 min-w-11 items-center justify-center rounded-pill px-3 text-sm font-bold',
                    entry === page.page
                      ? 'bg-accent text-accent-ink'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {entry}
                </Link>
              </li>
            )
          )}
          <li>
            {hasNext ? (
              <Link
                href={hrefFor(page.page + 1)}
                rel="next"
                className={cn(EDGE_CLASS, 'border-border bg-card hover:bg-muted')}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={cn(EDGE_CLASS, 'border-border text-muted-foreground opacity-60')}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}
