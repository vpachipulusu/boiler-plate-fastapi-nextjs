'use server';

import { revalidatePath } from 'next/cache';
import { merchantFormSchema } from '@/lib/admin-catalogue/merchant-schema';
import {
  asAdmin,
  failed,
  invalidForm,
  notFound,
  refreshPublicCatalogue,
  resourceIdSchema,
  type CatalogueActionResult,
} from '@/lib/api/admin-catalogue-action';
import { MERCHANT_NOT_FOUND_MESSAGE } from '@/lib/api/admin-catalogue-errors';
import {
  createAdminMerchant,
  patchAdminMerchant,
  setAdminMerchantActive,
  toCreateMerchantBody,
  toUpdateMerchantBody,
} from '@/lib/api/admin-merchants';

/**
 * Admin merchant actions. Same contract as the offer actions: admin gate first, Zod validation, the wrapper,
 * curated messages. The API needs `merchants.write`. Merchants appear on public offer pages, so the public
 * catalogue refreshes after a write.
 */

export type MerchantSavedData = { id: string; slug: string; active: boolean };

const ADMIN_MERCHANTS_PATH = '/admin/merchants';

function refresh(merchantId?: string): void {
  revalidatePath(ADMIN_MERCHANTS_PATH);
  if (merchantId) revalidatePath(`${ADMIN_MERCHANTS_PATH}/${merchantId}`);
  refreshPublicCatalogue();
}

export async function createMerchantAction(
  input: unknown
): Promise<CatalogueActionResult<MerchantSavedData>> {
  return asAdmin(async () => {
    const parsed = merchantFormSchema.safeParse(input);
    if (!parsed.success) return invalidForm(parsed.error);

    const result = await createAdminMerchant(toCreateMerchantBody(parsed.data));
    if (!result.success) {
      return failed(result, MERCHANT_NOT_FOUND_MESSAGE, 'Admin create merchant failed');
    }
    refresh();
    const { id, slug, active } = result.data;
    return { success: true, data: { id, slug, active } };
  });
}

export async function updateMerchantAction(
  merchantId: string,
  input: unknown
): Promise<CatalogueActionResult<MerchantSavedData>> {
  return asAdmin(async () => {
    if (!resourceIdSchema.safeParse(merchantId).success)
      return notFound(MERCHANT_NOT_FOUND_MESSAGE);
    const parsed = merchantFormSchema.safeParse(input);
    if (!parsed.success) return invalidForm(parsed.error);

    const result = await patchAdminMerchant(merchantId, toUpdateMerchantBody(parsed.data));
    if (!result.success) {
      return failed(result, MERCHANT_NOT_FOUND_MESSAGE, 'Admin update merchant failed');
    }
    refresh(merchantId);
    const { id, slug, active } = result.data;
    return { success: true, data: { id, slug, active } };
  });
}

export async function setMerchantActiveAction(
  merchantId: string,
  active: boolean
): Promise<CatalogueActionResult<MerchantSavedData>> {
  return asAdmin(async () => {
    if (!resourceIdSchema.safeParse(merchantId).success)
      return notFound(MERCHANT_NOT_FOUND_MESSAGE);

    const result = await setAdminMerchantActive(merchantId, active === true);
    if (!result.success) {
      return failed(result, MERCHANT_NOT_FOUND_MESSAGE, 'Admin set merchant active failed');
    }
    refresh(merchantId);
    const { id, slug, active: nowActive } = result.data;
    return { success: true, data: { id, slug, active: nowActive } };
  });
}
