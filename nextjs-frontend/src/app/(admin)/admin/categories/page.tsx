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
import { fetchAdminCategories, toCategoryView } from '@/lib/api/admin-categories';
import { logCatalogueFailure } from '@/lib/api/admin-catalogue-log';
import { formatAdminDate } from '../_components/format-admin-date';
import { InlineError } from '../_components/inline-error';
import { StateToggleButton } from '../_components/state-toggle-button';

export const metadata = { title: 'Categories' };

const CATEGORIES_PATH = '/admin/categories';

export default async function AdminCategoriesPage() {
  const result = await fetchAdminCategories();
  if (!result.success) logCatalogueFailure('Admin categories page: list failed', result);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Group freebies on the public site. A disabled category and its offers are hidden.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href={`${CATEGORIES_PATH}/new`}>
            <Plus aria-hidden="true" />
            Add category
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!result.success ? (
            <InlineError
              message={catalogueErrorMessage(result, 'The categories could not be loaded.')}
              retryHref={CATEGORIES_PATH}
            />
          ) : (
            <CategoriesTable
              categories={result.data.categories.map(toCategoryView)}
              total={result.data.total_count}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoriesTable({
  categories,
  total,
}: {
  categories: ReturnType<typeof toCategoryView>[];
  total: number;
}) {
  if (categories.length === 0) {
    return <p className="py-10 text-center font-medium">No categories yet</p>;
  }
  return (
    <section aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="mb-3 text-lg font-semibold">
        All categories ({total})
      </h2>
      <Table stacked>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead numeric>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="max-sm:w-full">
                <Link
                  href={`${CATEGORIES_PATH}/${category.id}`}
                  className="inline-flex min-h-11 items-center break-words font-medium underline-offset-4 hover:underline"
                >
                  {category.name}
                </Link>
                <div className="text-muted-foreground">{category.description}</div>
              </TableCell>
              <TableCell label="Slug" className="break-all text-muted-foreground">
                {category.slug}
              </TableCell>
              <TableCell label="Order" numeric>
                {category.sortOrder}
              </TableCell>
              <TableCell label="Status">
                <StatusPill variant={category.enabled ? 'good' : 'neutral'}>
                  {category.enabled ? 'Enabled' : 'Disabled'}
                </StatusPill>
              </TableCell>
              <TableCell label="Updated" className="text-muted-foreground">
                {formatAdminDate(category.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`${CATEGORIES_PATH}/${category.id}`}
                    className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline"
                  >
                    Edit<span className="sr-only"> {category.name}</span>
                  </Link>
                  <StateToggleButton
                    kind="category"
                    id={category.id}
                    name={category.name}
                    on={category.enabled}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {total > categories.length ? (
        <p className="pt-3 text-sm text-muted-foreground">
          Showing the first {categories.length} of {total} categories.
        </p>
      ) : null}
    </section>
  );
}
