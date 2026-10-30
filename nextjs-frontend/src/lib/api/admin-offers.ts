import 'server-only';

import {
  isOfferStatus,
  OFFER_STATUSES,
  type OfferAction,
  type OfferStatus,
} from '@/lib/admin-catalogue/offer-status';
import type {
  OfferDetailView,
  OfferLinkView,
  OfferRowView,
} from '@/lib/admin-catalogue/offer-view';
import { callBackend, type ApiResult } from './server';
import {
  adminArchiveOffer,
  adminCreateOffer,
  adminExpireOffer,
  adminListOffers,
  adminPublishOffer,
  adminReadOffer,
  adminUnpublishOffer,
  adminUpdateOffer,
  adminVerifyOffer,
  type AffiliateLinkOut,
  type CreateOfferRequest,
  type OfferOut,
  type OfferSummaryOut,
  type UpdateOfferRequest,
} from './generated';

/**
 * Server-only calls to the admin offers API (`/v1/admin/offers`) for the admin pages and server actions.
 * Callers import these instead of the generated SDK (ADR-008). The backend authenticates the session, checks the
 * admin's permission on every call (`offers.read`, `offers.write`, `offers.publish`) and writes the audit log.
 */

export const ADMIN_OFFERS_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 100;
const COUNT_ONLY_LIMIT = 1;

export interface OfferListParams {
  search?: string;
  status?: OfferStatus;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export function fetchAdminOffers(params: OfferListParams) {
  const search = params.search?.trim().slice(0, MAX_SEARCH_LENGTH);
  return callBackend((client) =>
    adminListOffers({
      client,
      query: {
        limit: params.limit ?? ADMIN_OFFERS_PAGE_SIZE,
        offset: params.offset ?? 0,
        ...(search ? { search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.categoryId ? { category_id: params.categoryId } : {}),
      },
    })
  );
}

export function fetchAdminOffer(offerId: string) {
  return callBackend((client) => adminReadOffer({ client, path: { offer_id: offerId } }));
}

export function createAdminOffer(body: CreateOfferRequest) {
  return callBackend((client) => adminCreateOffer({ client, body }));
}

export function patchAdminOffer(offerId: string, body: UpdateOfferRequest) {
  return callBackend((client) => adminUpdateOffer({ client, path: { offer_id: offerId }, body }));
}

/** The lifecycle calls. `verify` may carry a note that goes to the audit trail only. */
export function runAdminOfferAction(offerId: string, action: OfferAction, note?: string) {
  const path = { offer_id: offerId };
  return callBackend((client) => {
    switch (action) {
      case 'publish':
        return adminPublishOffer({ client, path });
      case 'unpublish':
        return adminUnpublishOffer({ client, path });
      case 'expire':
        return adminExpireOffer({ client, path });
      case 'archive':
        return adminArchiveOffer({ client, path });
      case 'verify':
        return adminVerifyOffer({ client, path, body: note ? { note } : {} });
    }
  });
}

export type OfferStatusCounts = Record<OfferStatus | 'TOTAL', number>;

/**
 * Offer counts for the stats strip, read from the list endpoint's `total_count` (a one-row page per status plus
 * one without a filter). Nothing is estimated: if any call fails the whole read fails and the strip says so.
 */
export async function fetchOfferStatusCounts(): Promise<ApiResult<OfferStatusCounts>> {
  const [total, ...byStatus] = await Promise.all([
    fetchAdminOffers({ limit: COUNT_ONLY_LIMIT }),
    ...OFFER_STATUSES.map((status) => fetchAdminOffers({ status, limit: COUNT_ONLY_LIMIT })),
  ]);
  if (!total.success) return total;
  const counts: Partial<OfferStatusCounts> = { TOTAL: total.data.total_count };
  for (const [index, result] of byStatus.entries()) {
    if (!result.success) return result;
    counts[OFFER_STATUSES[index]] = result.data.total_count;
  }
  return { success: true, data: counts as OfferStatusCounts };
}

/** An unknown status from a newer API is shown as a draft, the safest reading (nothing is public). */
function readStatus(value: string): OfferStatus {
  return isOfferStatus(value) ? value : 'DRAFT';
}

export function toOfferRow(offer: OfferSummaryOut): OfferRowView {
  return {
    id: offer.id,
    title: offer.title,
    slug: offer.slug,
    categoryId: offer.category_id,
    merchantId: offer.merchant_id,
    offerType: offer.offer_type,
    status: readStatus(offer.status),
    featured: offer.featured,
    endAt: offer.end_at,
    lastVerifiedAt: offer.last_verified_at,
    updatedAt: offer.updated_at,
  };
}

function toOfferLink(link: AffiliateLinkOut): OfferLinkView {
  return {
    id: link.id,
    provider: link.provider,
    destinationUrl: link.destination_url,
    active: link.active,
  };
}

function toStepView(step: Record<string, unknown>) {
  return {
    title: typeof step.title === 'string' ? step.title : '',
    detail: typeof step.detail === 'string' ? step.detail : '',
  };
}

export function toOfferDetail(offer: OfferOut): OfferDetailView {
  return {
    ...toOfferRow(offer),
    summary: offer.summary,
    description: offer.description,
    imageTint: offer.image_tint,
    imageLabel: offer.image_label,
    imageAlt: offer.image_alt,
    sourceUrl: offer.source_url,
    postageKind: offer.postage_kind,
    postageAmountMinor: offer.postage_amount_minor,
    postageCurrency: offer.postage_currency,
    requiresCard: offer.requires_card,
    subscriptionTerms: offer.subscription_terms,
    eligibility: offer.eligibility,
    availability: offer.availability,
    steps: offer.steps.map(toStepView),
    startAt: offer.start_at,
    freshness: offer.freshness,
    publisherNotes: offer.publisher_notes,
    createdAt: offer.created_at,
    links: offer.links.map(toOfferLink),
  };
}
