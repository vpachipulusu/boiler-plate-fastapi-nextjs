import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { auditLogsHref, maxAuditLogPage, type AuditLogsQuery } from './audit-logs-query';

/**
 * Previous and Next links that keep every filter, with a "Page X of Y" indicator. Pages past the API's offset
 * limit cannot exist: the note tells the admin to narrow the filters instead.
 */
export function AuditLogsPagination({ query, total }: { query: AuditLogsQuery; total: number }) {
  const lastPage = maxAuditLogPage(query.size);
  const reachableTotal = Math.ceil(total / query.size);
  const pageCount = Math.max(Math.min(reachableTotal, lastPage), query.page);
  const hasNext = query.page < Math.min(reachableTotal, lastPage);
  const capped = query.page >= lastPage && query.page < reachableTotal;
  if (query.page === 1 && !hasNext) return null;

  return (
    <div className="space-y-2 pt-4">
      <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
        {query.page > 1 ? (
          <Button variant="outline" asChild>
            <Link href={auditLogsHref({ ...query, page: query.page - 1 })} rel="prev">
              Previous
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted-foreground">
          Page {query.page} of {pageCount}
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
