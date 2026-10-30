import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { StatusPill } from '@/components/ui/status-pill';
import { categoryToFormValues } from '@/lib/admin-catalogue/category-schema';
import {
  catalogueErrorMessage,
  CATEGORY_NOT_FOUND_MESSAGE,
} from '@/lib/api/admin-catalogue-errors';
import { fetchAdminCategory, toCategoryView } from '@/lib/api/admin-categories';
import { logCatalogueFailure } from '@/lib/api/admin-catalogue-log';
import { InlineError } from '../../_components/inline-error';
import { requireAdminPage } from '../../_lib/require-admin-page';
import { CategoryForm } from '../category-form';

type Params = Promise<{ id: string }>;

const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const metadata = { title: 'Edit category' };

export default async function EditCategoryPage({ params }: { params: Params }) {
  await requireAdminPage();
  const { id } = await params;
  if (!RESOURCE_ID.test(id)) notFound();

  const result = await fetchAdminCategory(id);
  if (!result.success && result.status === 404) notFound();
  if (!result.success) {
    logCatalogueFailure('Admin category page: read failed', result);
    return (
      <InlineError
        message={catalogueErrorMessage(result, CATEGORY_NOT_FOUND_MESSAGE)}
        retryHref={`/admin/categories/${id}`}
      />
    );
  }

  const category = toCategoryView(result.data);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/categories"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to categories
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-words text-3xl font-bold tracking-tight">{category.name}</h1>
          <StatusPill variant={category.enabled ? 'good' : 'neutral'}>
            {category.enabled ? 'Enabled' : 'Disabled'}
          </StatusPill>
        </div>
      </div>
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        initialValues={categoryToFormValues(category)}
      />
    </div>
  );
}
