import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { auditLogsHref, maxAuditLogPage, type AuditLogsQuery } from './audit-logs-query';

/**
 * Previous and Next links that keep every filter, with a "Page X of Y" indicator. Pages past the API's offset
 * limit cannot exist: when the results run past it the count says "Y+" and a note tells the admin to narrow the
 * filters instead. On a phone the indicator takes its own row above the two buttons.
 */
export function AuditLogsPagination({ query, total }: { query: AuditLogsQuery; total: number }) {
  const lastPage = maxAuditLogPage(query.size);
  const reachableTotal = Math.ceil(total / query.size);
  const pageCount = Math.max(Math.min(reachableTotal, lastPage), query.page);
  const hasNext = query.page < Math.min(reachableTotal, lastPage);
  const capped = reachableTotal > lastPage;
  if (query.page === 1 && !hasNext) return null;

  return (
    <div className="space-y-2 pt-4">
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
        {query.page > 1 ? (
          <Button variant="outline" asChild>
            <Link href={auditLogsHref({ ...query, page: query.page - 1 })} rel="prev">
              Previous
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <span className="order-first w-full text-center text-sm text-muted-foreground sm:order-none sm:w-auto">
          Page {query.page} of {pageCount}
          {capped ? '+' : ''}
        </span>
        {hasNext ? (
          <Button variant="outline" asChild>
            <Link href={auditLogsHref({ ...query, page: query.page + 1 })} rel="next">
              Next
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
      {capped ? (
        <p className="text-center text-xs text-muted-foreground">
          Older entries cannot be paged to. Narrow the filters or the date range to reach them.
        </p>
      ) : null}
    </div>
  );
}
