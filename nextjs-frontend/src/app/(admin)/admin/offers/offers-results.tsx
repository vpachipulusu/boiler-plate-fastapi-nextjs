import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { catalogueErrorMessage } from '@/lib/api/admin-catalogue-errors';
import { ADMIN_OFFERS_PAGE_SIZE, fetchAdminOffers, toOfferRow } from '@/lib/api/admin-offers';
import { logCatalogueFailure } from '@/lib/api/admin-catalogue-log';
import { InlineError } from '../_components/inline-error';
import { loadCategoryOptions, loadMerchantOptions, optionNames } from '../_lib/pick-lists';
import { OffersTable, type OfferTableRow } from './offers-table';
import { offersHref, OFFERS_PATH, type OffersQuery } from './offers-query';

const UNKNOWN_NAME = 'Unknown';

function emptyMessage({ q, status, category, page }: OffersQuery): string {
  if (page > 1) return 'No offers on this page';
  if (q) return `No offers match '${q}'`;
  if (status || category) return 'No offers match these filters';
  return 'No offers yet';
}

/** Which rows are on screen, for example "Showing 26 to 50 of 61 offers". */
function rangeText(page: number, shown: number, total: number): string {
  const first = (page - 1) * ADMIN_OFFERS_PAGE_SIZE + 1;
  return `Showing ${first} to ${first + shown - 1} of ${total} offers`;
}

export async function OffersResults({ query }: { query: OffersQuery }) {
  const [result, categories, merchants] = await Promise.all([
    fetchAdminOffers({
      search: query.q,
      status: query.status,
      categoryId: query.category,
      limit: ADMIN_OFFERS_PAGE_SIZE,
      offset: (query.page - 1) * ADMIN_OFFERS_PAGE_SIZE,
    }),
    loadCategoryOptions(),
    loadMerchantOptions(),
  ]);

  if (!result.success) {
    logCatalogueFailure('Admin offers page: list failed', result);
    return (
      <InlineError
        message={catalogueErrorMessage(result, 'The offers could not be loaded.')}
        retryHref={offersHref(query)}
      />
    );
  }

  const categoryNames = optionNames(categories);
  const merchantNames = optionNames(merchants);
  const rows: OfferTableRow[] = result.data.offers.map((offer) => ({
    ...toOfferRow(offer),
    categoryName: categoryNames.get(offer.category_id) ?? UNKNOWN_NAME,
    merchantName: merchantNames.get(offer.merchant_id) ?? UNKNOWN_NAME,
  }));
  const total = result.data.total_count;
  const hasNext = query.page * ADMIN_OFFERS_PAGE_SIZE < total;
  const filtered = Boolean(query.q || query.status || query.category);

  return (
    <section aria-labelledby="offers-heading">
      <h2 id="offers-heading" className="mb-3 text-lg font-semibold">
        {filtered ? `Matching offers (${total})` : `All offers (${total})`}
      </h2>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="break-all font-medium">{emptyMessage(query)}</p>
          {(filtered || query.page > 1) && (
            <Button variant="outline" asChild>
              <Link href={filtered ? OFFERS_PATH : offersHref({ ...query, page: 1 })}>
                {filtered ? 'Clear filters' : 'Back to first page'}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <OffersTable rows={rows} />
          <p className="pt-3 text-sm text-muted-foreground">
            {rangeText(query.page, rows.length, total)}
          </p>
        </>
      )}
      {(query.page > 1 || hasNext) && (
        <nav aria-label="Pagination" className="flex justify-between pt-4">
          {query.page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={offersHref({ ...query, page: query.page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          {hasNext && (
            <Button variant="outline" asChild>
              <Link href={offersHref({ ...query, page: query.page + 1 })}>Next</Link>
            </Button>
          )}
        </nav>
      )}
    </section>
  );
}
