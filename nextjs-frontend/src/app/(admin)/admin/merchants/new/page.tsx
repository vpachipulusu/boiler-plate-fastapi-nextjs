import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { emptyMerchantFormValues } from '@/lib/admin-catalogue/merchant-schema';
import { MerchantForm } from '../merchant-form';

export const metadata = { title: 'Add merchant' };

export default function NewMerchantPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/merchants"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to merchants
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add merchant</h1>
      </div>
      <MerchantForm mode="create" initialValues={emptyMerchantFormValues()} />
    </div>
  );
}
