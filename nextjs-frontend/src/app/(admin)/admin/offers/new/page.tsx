import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { emptyOfferFormValues } from '@/lib/admin-catalogue/offer-schema';
import { InlineError } from '../../_components/inline-error';
import { loadCategoryOptions, loadMerchantOptions, TRUNCATED_NOTICE } from '../../_lib/pick-lists';
import { requireAdminPage } from '../../_lib/require-admin-page';

import { OfferForm } from '../_components/offer-form';

export const metadata = { title: 'Add freebie' };

const NEW_OFFER_PATH = '/admin/offers/new';

export default async function NewOfferPage() {
  await requireAdminPage();
  const [categories, merchants] = await Promise.all([loadCategoryOptions(), loadMerchantOptions()]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/offers"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to freebies
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add freebie</h1>
        <p className="text-muted-foreground">
          A new offer starts as a draft. Verify it, then publish it, to put it on the site.
        </p>
      </div>

      {!categories.ok || !merchants.ok ? (
        <InlineError
          message={!categories.ok ? categories.message : !merchants.ok ? merchants.message : ''}
          retryHref={NEW_OFFER_PATH}
        />
      ) : categories.options.length === 0 || merchants.options.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm">
          An offer needs a category and a merchant.{' '}
          <Link href="/admin/categories" className="font-semibold underline underline-offset-4">
            Categories
          </Link>{' '}
          and{' '}
          <Link href="/admin/merchants" className="font-semibold underline underline-offset-4">
            merchants
          </Link>{' '}
          must be added first.
        </p>
      ) : (
        <>
          {categories.truncated || merchants.truncated ? (
            <p className="text-sm text-muted-foreground">{TRUNCATED_NOTICE}</p>
          ) : null}
          <OfferForm
            mode="create"
            initialValues={emptyOfferFormValues()}
            categories={categories.options}
            merchants={merchants.options}
          />
        </>
      )}
    </div>
  );
}
