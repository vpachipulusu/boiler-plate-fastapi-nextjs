import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { catalogueErrorMessage } from '@/lib/api/admin-catalogue-errors';
import { fetchAdminMerchants, toMerchantView } from '@/lib/api/admin-merchants';
import { logCatalogueFailure } from '@/lib/api/admin-catalogue-log';
import { EmptyCell } from '../_components/empty-cell';
import { formatAdminDate } from '../_components/format-admin-date';
import { InlineError } from '../_components/inline-error';
import { requireAdminPage } from '../_lib/require-admin-page';
import { StateToggleButton } from '../_components/state-toggle-button';

export const metadata = { title: 'Merchants' };

const MERCHANTS_PATH = '/admin/merchants';

export default async function AdminMerchantsPage() {
  await requireAdminPage();
  const result = await fetchAdminMerchants();
  if (!result.success) logCatalogueFailure('Admin merchants page: list failed', result);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Merchants</h1>
          <p className="text-muted-foreground">
            The brands behind each freebie. An offer can only be published for an active merchant.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href={`${MERCHANTS_PATH}/new`}>
            <Plus aria-hidden="true" />
            Add merchant
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!result.success ? (
            <InlineError
              message={catalogueErrorMessage(result, 'The merchants could not be loaded.')}
              retryHref={MERCHANTS_PATH}
            />
          ) : (
            <MerchantsTable
              merchants={result.data.merchants.map(toMerchantView)}
              total={result.data.total_count}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MerchantsTable({
  merchants,
  total,
}: {
  merchants: ReturnType<typeof toMerchantView>[];
  total: number;
}) {
  if (merchants.length === 0) {
    return <p className="py-10 text-center font-medium">No merchants yet</p>;
  }
  return (
    <section aria-labelledby="merchants-heading">
      <h2 id="merchants-heading" className="mb-3 text-lg font-semibold">
        All merchants ({total})
      </h2>
      <Table stacked aria-labelledby="merchants-heading">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {merchants.map((merchant) => (
            <TableRow key={merchant.id}>
              <TableCell className="max-sm:w-full">
                <Link
                  href={`${MERCHANTS_PATH}/${merchant.id}`}
                  className="inline-flex min-h-11 items-center break-words font-medium underline-offset-4 hover:underline"
                >
                  {merchant.name}
                </Link>
              </TableCell>
              <TableCell label="Slug" className="break-all text-muted-foreground">
                {merchant.slug}
              </TableCell>
              <TableCell label="Website" className="break-all text-muted-foreground">
                {merchant.website ?? <EmptyCell />}
              </TableCell>
              <TableCell label="Status">
                <StatusPill variant={merchant.active ? 'good' : 'neutral'}>
                  {merchant.active ? 'Active' : 'Inactive'}
                </StatusPill>
              </TableCell>
              <TableCell label="Updated" className="text-muted-foreground">
                {formatAdminDate(merchant.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`${MERCHANTS_PATH}/${merchant.id}`}
                    className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline"
                  >
                    Edit<span className="sr-only"> {merchant.name}</span>
                  </Link>
                  <StateToggleButton
                    kind="merchant"
                    id={merchant.id}
                    name={merchant.name}
                    on={merchant.active}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {total > merchants.length ? (
        <p className="pt-3 text-sm text-muted-foreground">
          Showing the first {merchants.length} of {total} merchants.
        </p>
      ) : null}
    </section>
  );
}
