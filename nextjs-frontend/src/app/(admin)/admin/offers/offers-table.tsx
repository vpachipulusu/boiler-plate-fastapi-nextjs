import Link from 'next/link';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OFFER_STATUS_LABELS, OFFER_STATUS_VARIANTS } from '@/lib/admin-catalogue/offer-status';
import { offerTypeLabel } from '@/lib/admin-catalogue/offer-labels';
import type { OfferRowView } from '@/lib/admin-catalogue/offer-view';
import { formatAdminDate } from '../_components/format-admin-date';
import { OfferRowActions } from './_components/offer-row-actions';

export type OfferTableRow = OfferRowView & { categoryName: string; merchantName: string };

export const OFFERS_COLUMNS = ['Offer', 'Category', 'Status', 'Verified', 'Actions'];

function VerifiedCell({ value }: { value: string | null }) {
  const formatted = value ? formatAdminDate(value) : '';
  if (formatted) return <span className="text-muted-foreground">{formatted}</span>;
  return <span className="text-warn-foreground">Not verified</span>;
}

/** The offers list. Below 640px each row stacks and every cell names its column. */
export function OffersTable({ rows }: { rows: OfferTableRow[] }) {
  return (
    <Table stacked>
      <TableHeader>
        <TableRow>
          {OFFERS_COLUMNS.map((column) => (
            <TableHead key={column} className={column === 'Actions' ? 'text-right' : undefined}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="max-sm:w-full">
              <Link
                href={`/admin/offers/${row.id}`}
                className="inline-flex min-h-11 items-center break-words font-medium underline-offset-4 hover:underline"
              >
                {row.title}
              </Link>
              <div className="text-muted-foreground">
                {row.merchantName} · {offerTypeLabel(row.offerType)}
              </div>
            </TableCell>
            <TableCell label="Category" className="text-muted-foreground">
              {row.categoryName}
            </TableCell>
            <TableCell label="Status">
              <StatusPill variant={OFFER_STATUS_VARIANTS[row.status]}>
                {OFFER_STATUS_LABELS[row.status]}
              </StatusPill>
            </TableCell>
            <TableCell label="Verified">
              <VerifiedCell value={row.lastVerifiedAt} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/admin/offers/${row.id}`}
                  className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline"
                >
                  Edit<span className="sr-only"> {row.title}</span>
                </Link>
                <OfferRowActions offerId={row.id} offerTitle={row.title} status={row.status} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
