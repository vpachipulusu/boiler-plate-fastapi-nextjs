import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AUDIT_LOG_PAGE_SIZES } from '@/lib/admin-audit/paging';
import { NativeSelect } from '../_components/native-select';
import { AUDIT_LOGS_PATH, type AuditLogsQuery } from './audit-logs-query';

const HINT = 'text-xs text-muted-foreground';

/**
 * The audit log filters: a plain GET form, so every filter lives in the URL (shareable, bookmarkable) and works
 * without script. Submitting always starts again at page 1. "Reset filters" is a link back to the bare path.
 */
export function AuditLogsFilters({ query, notices }: { query: AuditLogsQuery; notices: string[] }) {
  return (
    <form action={AUDIT_LOGS_PATH} method="get" role="search" aria-label="Filter audit log entries">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="audit-action">Action</Label>
          <Input
            key={query.action ?? ''}
            id="audit-action"
            name="action"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="audit-action-hint"
            defaultValue={query.action}
          />
          <p id="audit-action-hint" className={HINT}>
            Exact action, for example admin.offers.update
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-user">User ID</Label>
          <Input
            key={query.user ?? ''}
            id="audit-user"
            name="user"
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="audit-user-hint"
            defaultValue={query.user}
          />
          <p id="audit-user-hint" className={HINT}>
            The admin who made the change
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-org">Organisation ID</Label>
          <Input
            key={query.org ?? ''}
            id="audit-org"
            name="org"
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            defaultValue={query.org}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-from">From date</Label>
          <Input
            key={query.from ?? ''}
            id="audit-from"
            type="date"
            name="from"
            aria-describedby="audit-date-hint"
            defaultValue={query.from}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-to">To date</Label>
          <Input
            key={query.to ?? ''}
            id="audit-to"
            type="date"
            name="to"
            aria-describedby="audit-date-hint"
            defaultValue={query.to}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-size">Entries per page</Label>
          <NativeSelect
            key={query.size}
            id="audit-size"
            name="size"
            defaultValue={String(query.size)}
          >
            {AUDIT_LOG_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p id="audit-date-hint" className={`${HINT} mt-3`}>
        Dates are in UTC and include the whole day.
      </p>
      {notices.length > 0 ? (
        <ul role="status" className="mt-3 space-y-1 text-sm text-destructive">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit">Apply filters</Button>
        <Button variant="outline" asChild>
          <Link href={AUDIT_LOGS_PATH}>Reset filters</Link>
        </Button>
      </div>
    </form>
  );
}
