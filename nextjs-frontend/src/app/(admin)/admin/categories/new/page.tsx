import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { emptyCategoryFormValues } from '@/lib/admin-catalogue/category-schema';
import { requireAdminPage } from '../../_lib/require-admin-page';
import { CategoryForm } from '../category-form';

export const metadata = { title: 'Add category' };

export default async function NewCategoryPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/categories"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to categories
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add category</h1>
      </div>
      <CategoryForm mode="create" initialValues={emptyCategoryFormValues()} />
    </div>
  );
}
