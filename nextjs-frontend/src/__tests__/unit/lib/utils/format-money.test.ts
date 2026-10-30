/** the shared money formatter: en-GB, GBP unless the data carries a currency, never a bare dollar sign. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY_CODE } from '@/config/currencies';
import { MONEY_LOCALE, formatCount, formatMinorUnits } from '@/lib/utils/format-money';

describe('formatMinorUnits', () => {
  it('defaults to pounds when no currency is given', () => {
    expect(formatMinorUnits(23000)).toBe('£230.00');
    expect(DEFAULT_CURRENCY_CODE).toBe('GBP');
    expect(MONEY_LOCALE).toBe('en-GB');
  });

  it.each([undefined, null, '', '   '])('defaults to pounds for the currency %j', (currency) => {
    expect(formatMinorUnits(1250, currency)).toBe('£12.50');
  });

  it('honours an explicit currency from the data, in any case', () => {
    expect(formatMinorUnits(2900, 'USD')).toBe('US$29.00');
    expect(formatMinorUnits(2900, 'usd')).toBe('US$29.00');
    expect(formatMinorUnits(2900, 'EUR')).toBe('€29.00');
    expect(formatMinorUnits(2900, 'GBP')).toBe('£29.00');
  });

  it('uses the currency own number of decimals', () => {
    expect(formatMinorUnits(1500, 'JPY')).toBe('JP¥1,500');
  });

  it('formats zero', () => {
    expect(formatMinorUnits(0)).toBe('£0.00');
  });

  it('formats a large amount with grouping', () => {
    expect(formatMinorUnits(123456789)).toBe('£1,234,567.89');
  });

  it('formats a negative amount (a refund or credit)', () => {
    expect(formatMinorUnits(-1250)).toBe('-£12.50');
    expect(formatMinorUnits(-1250, 'USD')).toBe('-US$12.50');
  });

  it('shows the number and the code for a code the runtime does not know', () => {
    expect(formatMinorUnits(1250, 'not-a-code')).toBe('1250 not-a-code');
  });
});

describe('formatCount', () => {
  it('groups thousands the UK way', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});
