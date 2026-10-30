import { cache } from 'react';
import { catalogueErrorMessage } from '@/lib/api/admin-catalogue-errors';
import { fetchAdminCategories } from '@/lib/api/admin-categories';
import { fetchAdminMerchants } from '@/lib/api/admin-merchants';
import { logCatalogueFailure } from '@/lib/api/admin-catalogue-log';

/**
 * Category and merchant pick lists for the offer pages. `cache` makes a list one backend call per request even
 * when the page, its results and its form all ask. A name carries its state ("disabled", "inactive") so an admin
 * is not surprised when publishing is refused for it. The API caps a page at 100 rows; that is plenty for a
 * catalogue of a few categories and merchants, and `truncated` says so if it ever is not.
 */

export type PickOption = { id: string; name: string };

export type PickListResult =
  | { ok: true; options: PickOption[]; truncated: boolean }
  | { ok: false; message: string };

const NOT_FOUND = 'The list could not be loaded.';

export const loadCategoryOptions = cache(async (): Promise<PickListResult> => {
  const result = await fetchAdminCategories();
  if (!result.success) {
    logCatalogueFailure('Admin pick list: categories failed', result);
    return { ok: false, message: catalogueErrorMessage(result, NOT_FOUND) };
  }
  const { categories, total_count: total } = result.data;
  return {
    ok: true,
    truncated: total > categories.length,
    options: categories.map((c) => ({
      id: c.id,
      name: c.enabled ? c.name : `${c.name} (disabled)`,
    })),
  };
});

export const loadMerchantOptions = cache(async (): Promise<PickListResult> => {
  const result = await fetchAdminMerchants();
  if (!result.success) {
    logCatalogueFailure('Admin pick list: merchants failed', result);
    return { ok: false, message: catalogueErrorMessage(result, NOT_FOUND) };
  }
  const { merchants, total_count: total } = result.data;
  return {
    ok: true,
    truncated: total > merchants.length,
    options: merchants.map((m) => ({ id: m.id, name: m.active ? m.name : `${m.name} (inactive)` })),
  };
});

export function optionNames(list: PickListResult): Map<string, string> {
  return new Map(list.ok ? list.options.map((option) => [option.id, option.name]) : []);
}

/** The wording of the notice shown when a list holds only the first page of rows. */
export const TRUNCATED_NOTICE =
  'Only the first 100 are listed here, so others cannot be chosen on this page.';
