import { StatusPill } from '@/components/ui/status-pill';
import {
  OFFER_STATUS_ICONS,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_VARIANTS,
  type OfferRowStatus,
} from '@/lib/admin-catalogue/offer-status';

/** An offer's status as a pill: tint, icon and text (never colour alone). */
export function OfferStatusPill({ status }: { status: OfferRowStatus }) {
  return (
    <StatusPill
      variant={OFFER_STATUS_VARIANTS[status]}
      icon={OFFER_STATUS_ICONS[status]}
      data-testid="offer-status"
    >
      {OFFER_STATUS_LABELS[status]}
    </StatusPill>
  );
}
