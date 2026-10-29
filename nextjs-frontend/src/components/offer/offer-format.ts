import type { OfferType, Postage } from '@/lib/catalogue/types';

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

/** Caption-caps chip for the offer kind (design screen 03). */
export const KIND_CHIP_LABELS: Record<OfferType, string> = {
  free_sample: 'FREE PRODUCT',
  free_trial: 'FREE TRIAL',
  cashback: 'CASHBACK',
  voucher: 'VOUCHER',
  competition: 'COMPETITION',
};

export const CTA_LABELS: Record<OfferType, string> = {
  free_sample: 'Get this free sample',
  free_trial: 'Start the free trial',
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
