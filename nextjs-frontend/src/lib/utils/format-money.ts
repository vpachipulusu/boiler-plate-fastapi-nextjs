/**
 * Shared minor-unit money formatter for admin and dashboard billing amounts; offer postage is GBP-only and
 * formatted separately. UK locale, so GBP reads as a pound sign and a currency that is not pounds keeps its own
 * marking (USD is written US$, never a bare dollar sign).
 */
export const MONEY_LOCALE = 'en-GB';

export function formatCount(value: number): string {
  return value.toLocaleString(MONEY_LOCALE);
}

/**
 * Formats an amount in minor units (pence, cents) using the currency's own number of decimals (JPY has none).
 * The currency is required: it is the one the data carries (an ISO 4217 code, any case). The platform default
 * (GBP) is applied where the currency is looked up, not here. A code the runtime does not know is shown as the
 * major amount (two decimals) and the code.
 */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  try {
    const format = new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency: code });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(amountMinor / 10 ** digits);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${code}`;
  }
}
