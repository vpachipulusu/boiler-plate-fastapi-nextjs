/** the shared money formatter: en-GB, always the currency the data carries, never a bare dollar sign. */
import { describe, expect, it } from 'vitest';
import { MONEY_LOCALE, formatCount, formatMinorUnits } from '@/lib/utils/format-money';

describe('formatMinorUnits', () => {
  it('requires a currency', () => {
    expect(() => {
      // @ts-expect-error the currency is required: the platform default is applied where it is looked up
      formatMinorUnits(1);
    }).toThrow();
    expect(MONEY_LOCALE).toBe('en-GB');
  });

  it('formats pounds', () => {
    expect(formatMinorUnits(23000, 'GBP')).toBe('£230.00');
  });

  it('honours the currency from the data, in any case and with stray spaces', () => {
    expect(formatMinorUnits(2900, ' usd ')).toBe('US$29.00');
    expect(formatMinorUnits(2900, 'USD')).toBe('US$29.00');
    expect(formatMinorUnits(2900, 'usd')).toBe('US$29.00');
    expect(formatMinorUnits(2900, 'EUR')).toBe('€29.00');
    expect(formatMinorUnits(2900, 'GBP')).toBe('£29.00');
  });

  it('uses the currency own number of decimals', () => {
    expect(formatMinorUnits(1500, 'JPY')).toBe('JP¥1,500');
  });

  it('formats zero', () => {
    expect(formatMinorUnits(0, 'GBP')).toBe('£0.00');
  });

  it('formats a large amount with grouping', () => {
    expect(formatMinorUnits(123456789, 'GBP')).toBe('£1,234,567.89');
  });

  it('formats a negative amount (a refund or credit)', () => {
    expect(formatMinorUnits(-1250, 'GBP')).toBe('-£12.50');
    expect(formatMinorUnits(-1250, 'USD')).toBe('-US$12.50');
  });

  it('shows the major amount and the code for a code the runtime does not know', () => {
    expect(formatMinorUnits(1250, 'not-a-code')).toBe('12.50 NOT-A-CODE');
  });
});

describe('formatCount', () => {
  it('groups thousands the UK way', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});
