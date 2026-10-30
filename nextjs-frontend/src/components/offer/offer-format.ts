import type { Offer, OfferType, Postage } from '@/lib/catalogue/types';

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-10-29" -> "29 October 2026". Parses the ISO date as UTC so the day never shifts. */
export function formatIsoDate(iso: string): string {
  return DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

/** Short postage phrase: "Free", "£1.99" or "Check terms". */
export function postageText(postage: Postage): string {
  if (postage.kind === 'free') return 'Free';
  if (postage.kind === 'cost') return `£${(postage.amountMinor / 100).toFixed(2)}`;
  return 'Check terms';
}

/**
 * Caption-caps chip for the offer kind (design screen 03). No "free" here: the postage and card chips beside
 * it carry the conditions, and a sample with postage or a trial that needs a card is not simply free.
 */
export const KIND_CHIP_LABELS: Record<OfferType, string> = {
  free_sample: 'SAMPLE',
  free_trial: 'TRIAL',
  cashback: 'CASHBACK',
  voucher: 'VOUCHER',
  competition: 'COMPETITION',
};

export const CTA_LABELS: Record<OfferType, string> = {
  free_sample: 'Request this sample',
  free_trial: 'Start the trial',
  cashback: 'Get this cashback',
  voucher: 'Get this voucher',
  competition: 'Enter this competition',
};

/** What the visitor requests at the provider, for "You'll go to the brand's website to request your ...". */
export const REQUEST_KIND: Record<OfferType, string> = {
  free_sample: 'sample',
  free_trial: 'trial',
  cashback: 'cashback',
  voucher: 'voucher',
  competition: 'entry',
};

/**
 * The one line that travels with the call-to-action button: postage for a sample, the card requirement for
 * a trial (CAP 3.23, 3.24; docs/compliance/uk-affiliate-checklist.md B2, B3). Generated from the offer's own
 * fields, never typed copy. Null when the offer type has nothing to add.
 */
export function ctaConditions(
  offer: Pick<Offer, 'offerType' | 'postage' | 'requiresCard'>
): string | null {
  if (offer.offerType === 'free_sample') {
    const { postage } = offer;
    if (postage.kind === 'check_terms') return "Postage: check the brand's terms.";
    return `Postage: ${postageText(postage).toLowerCase()}.`;
  }
  if (offer.offerType === 'free_trial' && offer.requiresCard) {
    return 'A payment card is required to start.';
  }
  return null;
}
