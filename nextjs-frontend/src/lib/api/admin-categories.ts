import 'server-only';

import type { CategoryFormValues, CategoryView } from '@/lib/admin-catalogue/category-schema';
import { callBackend } from './server';
import {
  adminCreateCategory,
  adminDisableCategory,
  adminEnableCategory,
  adminListCategories,
  adminReadCategory,
  adminUpdateCategory,
  type CategoryOut,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from './generated';

/**
 * Server-only calls to the admin categories API (`/v1/admin/categories`). Reads need `offers.read`, writes
 * `categories.write`; the backend checks both and writes the audit log.
 */

/** The API's page cap. The offer form's pick list and the categories page read one page of this size. */
export const ADMIN_PICKLIST_LIMIT = 100;

export function fetchAdminCategories(params: { limit?: number; offset?: number } = {}) {
  return callBackend((client) =>
    adminListCategories({
      client,
      query: { limit: params.limit ?? ADMIN_PICKLIST_LIMIT, offset: params.offset ?? 0 },
    })
  );
}

export function fetchAdminCategory(categoryId: string) {
  return callBackend((client) => adminReadCategory({ client, path: { category_id: categoryId } }));
}

export function createAdminCategory(body: CreateCategoryRequest) {
  return callBackend((client) => adminCreateCategory({ client, body }));
}

export function patchAdminCategory(categoryId: string, body: UpdateCategoryRequest) {
  return callBackend((client) =>
    adminUpdateCategory({ client, path: { category_id: categoryId }, body })
  );
}

export function setAdminCategoryEnabled(categoryId: string, enabled: boolean) {
  const path = { category_id: categoryId };
  return callBackend((client) =>
    enabled ? adminEnableCategory({ client, path }) : adminDisableCategory({ client, path })
  );
}

export function toCreateCategoryBody(values: CategoryFormValues): CreateCategoryRequest {
  return {
    name: values.name,
    ...(values.slug === '' ? {} : { slug: values.slug }),
    short_name: values.shortName,
    description: values.description,
    intro: values.intro,
    tint: values.tint,
    sort_order: Number(values.sortOrder),
    enabled: values.enabled,
  };
}

/** The slug and the enabled flag are not editable here; enabling and disabling have their own routes. */
export function toUpdateCategoryBody(values: CategoryFormValues): UpdateCategoryRequest {
  return {
    name: values.name,
    short_name: values.shortName,
    description: values.description,
    intro: values.intro,
    tint: values.tint,
    sort_order: Number(values.sortOrder),
  };
}

export function toCategoryView(category: CategoryOut): CategoryView {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    shortName: category.short_name,
    description: category.description,
    intro: category.intro,
    tint: category.tint,
    sortOrder: category.sort_order,
    enabled: category.enabled,
    updatedAt: category.updated_at,
  };
}
