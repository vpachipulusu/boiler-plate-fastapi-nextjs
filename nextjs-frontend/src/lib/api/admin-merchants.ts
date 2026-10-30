import 'server-only';

import type { MerchantFormValues, MerchantView } from '@/lib/admin-catalogue/merchant-schema';
import { callBackend } from './server';
import { ADMIN_PICKLIST_LIMIT } from './admin-categories';
import {
  adminActivateMerchant,
  adminCreateMerchant,
  adminDeactivateMerchant,
  adminListMerchants,
  adminReadMerchant,
  adminUpdateMerchant,
  type CreateMerchantRequest,
  type MerchantOut,
  type UpdateMerchantRequest,
} from './generated';

/**
 * Server-only calls to the admin merchants API (`/v1/admin/merchants`). Reads need `offers.read`, writes
 * `merchants.write`; the backend checks both and writes the audit log.
 */

export function fetchAdminMerchants(params: { limit?: number; offset?: number } = {}) {
  return callBackend((client) =>
    adminListMerchants({
      client,
      query: { limit: params.limit ?? ADMIN_PICKLIST_LIMIT, offset: params.offset ?? 0 },
    })
  );
}

export function fetchAdminMerchant(merchantId: string) {
  return callBackend((client) => adminReadMerchant({ client, path: { merchant_id: merchantId } }));
}

export function createAdminMerchant(body: CreateMerchantRequest) {
  return callBackend((client) => adminCreateMerchant({ client, body }));
}

export function patchAdminMerchant(merchantId: string, body: UpdateMerchantRequest) {
  return callBackend((client) =>
    adminUpdateMerchant({ client, path: { merchant_id: merchantId }, body })
  );
}

export function setAdminMerchantActive(merchantId: string, active: boolean) {
  const path = { merchant_id: merchantId };
  return callBackend((client) =>
    active ? adminActivateMerchant({ client, path }) : adminDeactivateMerchant({ client, path })
  );
}

function textOrNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toCreateMerchantBody(values: MerchantFormValues): CreateMerchantRequest {
  return {
    name: values.name,
    ...(values.slug === '' ? {} : { slug: values.slug }),
    website: textOrNull(values.website),
    logo_url: textOrNull(values.logoUrl),
    active: values.active,
  };
}

/** The slug and the active flag are not editable here; activating and deactivating have their own routes. */
export function toUpdateMerchantBody(values: MerchantFormValues): UpdateMerchantRequest {
  return {
    name: values.name,
    website: textOrNull(values.website),
    logo_url: textOrNull(values.logoUrl),
  };
}

export function toMerchantView(merchant: MerchantOut): MerchantView {
  return {
    id: merchant.id,
    name: merchant.name,
    slug: merchant.slug,
    website: merchant.website,
    logoUrl: merchant.logo_url,
    active: merchant.active,
    updatedAt: merchant.updated_at,
  };
}
