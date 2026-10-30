import { DEFAULT_CURRENCY_CODE } from '@/config/currencies';

/**
 * The one place money and counts are formatted for display. UK locale, so GBP reads as a pound sign and a
 * currency that is not pounds keeps its own marking (USD is written US$, never a bare dollar sign).
 */
export const MONEY_LOCALE = 'en-GB';

export function formatCount(value: number): string {
  return value.toLocaleString(MONEY_LOCALE);
}

/**
 * Formats an amount in minor units (pence, cents) using the currency's own number of decimals (JPY has none).
 * The currency is the one the data carries (an ISO 4217 code, any case); a missing or blank one means the
 * platform default, GBP. A code the runtime does not know is shown as the bare number and the code.
 */
export function formatMinorUnits(amountMinor: number, currency?: string | null): string {
  const code = currency?.trim() || DEFAULT_CURRENCY_CODE;
  try {
    const format = new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency: code });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(amountMinor / 10 ** digits);
  } catch {
    return `${amountMinor} ${code}`;
  }
}
