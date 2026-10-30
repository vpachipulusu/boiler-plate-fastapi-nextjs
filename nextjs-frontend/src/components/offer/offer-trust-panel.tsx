import { Check, Info } from 'lucide-react';
import { DemoBadge } from '@/components/catalogue/demo-badge';
import type { Offer } from '@/lib/catalogue/types';
import { KIND_CHIP_LABELS, formatIsoDate, postageText } from './offer-format';

const CHIP_CLASS = 'text-[11px] font-bold tracking-wider text-accent-ink';

interface OfferTrustPanelProps {
  offer: Offer;
}

/**
 * Mint trust panel (design screen 03): the editor's last-checked date, the honest kind of offer,
 * postage and card requirement. A demo (fixture) offer never says "Last checked": its date is sample data,
 * so the panel calls it a sample date, swaps the tick for an info icon and says Freejoy has not checked it.
 */
export function OfferTrustPanel({ offer }: OfferTrustPanelProps) {
  const postage = postageText(offer.postage);
  const date = formatIsoDate(offer.lastVerifiedAt);
  return (
    <section
      aria-label={offer.demo ? 'Offer details' : 'Offer checks'}
      className="rounded-card bg-good p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-accent-ink">
          {offer.demo ? (
            <Info className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="font-display text-base font-bold text-foreground">
            {offer.demo ? `Sample date ${date}` : `Last checked ${date}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {offer.demo
              ? 'Sample listing: Freejoy has not checked this offer.'
              : 'Availability and eligibility can change at the provider.'}
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-3">
        <li className={CHIP_CLASS}>{KIND_CHIP_LABELS[offer.offerType]}</li>
        <li className={CHIP_CLASS}>{`POSTAGE: ${postage.toUpperCase()}`}</li>
        {offer.requiresCard && <li className={CHIP_CLASS}>CARD REQUIRED</li>}
        <li className={CHIP_CLASS}>UK OFFER</li>
      </ul>
      {offer.demo && <DemoBadge verbose className="mt-3" />}
    </section>
  );
}
