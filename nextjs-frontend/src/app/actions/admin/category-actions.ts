'use server';

import { revalidatePath } from 'next/cache';
import { categoryFormSchema } from '@/lib/admin-catalogue/category-schema';
import {
  asAdmin,
  failed,
  invalidForm,
  notFound,
  refreshPublicCatalogue,
  resourceIdSchema,
  type CatalogueActionResult,
} from '@/lib/api/admin-catalogue-action';
import { CATEGORY_NOT_FOUND_MESSAGE } from '@/lib/api/admin-catalogue-errors';
import {
  createAdminCategory,
  patchAdminCategory,
  setAdminCategoryEnabled,
  toCreateCategoryBody,
  toUpdateCategoryBody,
} from '@/lib/api/admin-categories';

/**
 * Admin category actions. Same contract as the offer actions: admin gate first, Zod validation, the wrapper,
 * curated messages. The API needs `categories.write`. A category change can alter public pages (a disabled
 * category's offers are hidden), so the public catalogue refreshes too.
 */

export type CategorySavedData = { id: string; slug: string; enabled: boolean };

const ADMIN_CATEGORIES_PATH = '/admin/categories';

function refresh(categoryId?: string): void {
  revalidatePath(ADMIN_CATEGORIES_PATH);
  if (categoryId) revalidatePath(`${ADMIN_CATEGORIES_PATH}/${categoryId}`);
  refreshPublicCatalogue();
}

export async function createCategoryAction(
  input: unknown
): Promise<CatalogueActionResult<CategorySavedData>> {
  return asAdmin(async () => {
    const parsed = categoryFormSchema.safeParse(input);
    if (!parsed.success) return invalidForm(parsed.error);

    const result = await createAdminCategory(toCreateCategoryBody(parsed.data));
    if (!result.success) {
      return failed(result, CATEGORY_NOT_FOUND_MESSAGE, 'Admin create category failed');
    }
    refresh();
    const { id, slug, enabled } = result.data;
    return { success: true, data: { id, slug, enabled } };
  });
}

export async function updateCategoryAction(
  categoryId: string,
  input: unknown
): Promise<CatalogueActionResult<CategorySavedData>> {
  return asAdmin(async () => {
    if (!resourceIdSchema.safeParse(categoryId).success)
      return notFound(CATEGORY_NOT_FOUND_MESSAGE);
    const parsed = categoryFormSchema.safeParse(input);
    if (!parsed.success) return invalidForm(parsed.error);

    const result = await patchAdminCategory(categoryId, toUpdateCategoryBody(parsed.data));
    if (!result.success) {
      return failed(result, CATEGORY_NOT_FOUND_MESSAGE, 'Admin update category failed');
    }
    refresh(categoryId);
    const { id, slug, enabled } = result.data;
    return { success: true, data: { id, slug, enabled } };
  });
}

export async function setCategoryEnabledAction(
  categoryId: string,
  enabled: boolean
): Promise<CatalogueActionResult<CategorySavedData>> {
  return asAdmin(async () => {
    if (!resourceIdSchema.safeParse(categoryId).success)
      return notFound(CATEGORY_NOT_FOUND_MESSAGE);

    const result = await setAdminCategoryEnabled(categoryId, enabled === true);
    if (!result.success) {
      return failed(result, CATEGORY_NOT_FOUND_MESSAGE, 'Admin set category enabled failed');
    }
    refresh(categoryId);
    const { id, slug, enabled: nowEnabled } = result.data;
    return { success: true, data: { id, slug, enabled: nowEnabled } };
  });
}
