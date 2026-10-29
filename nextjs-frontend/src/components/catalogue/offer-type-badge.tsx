import { cn } from '@/lib/utils';
import { OFFER_TYPE_LABELS, type OfferType } from '@/lib/catalogue/types';

interface OfferTypeBadgeProps {
  type: OfferType;
  className?: string;
}

/**
 * White pill naming the offer kind (design screens 01-03, 09). The label is the honest kind:
 * a trial, voucher, cashback or competition is never badged as a free sample.
 */
export function OfferTypeBadge({ type, className }: OfferTypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-pill bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-ink shadow-sm',
        className
      )}
    >
      {OFFER_TYPE_LABELS[type]}
    </span>
  );
}
