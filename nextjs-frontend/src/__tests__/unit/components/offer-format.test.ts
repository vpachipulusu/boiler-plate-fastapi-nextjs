import { describe, expect, it } from 'vitest';
import { CTA_LABELS, KIND_CHIP_LABELS, ctaConditions } from '@/components/offer/offer-format';

describe('offer kind chips and call-to-action labels', () => {
  it('does not call a sample or a trial "free" where postage or a card may apply', () => {
    expect(KIND_CHIP_LABELS.free_sample).toBe('SAMPLE');
    expect(KIND_CHIP_LABELS.free_trial).toBe('TRIAL');
    expect(CTA_LABELS.free_sample).toBe('Request this sample');
    expect(CTA_LABELS.free_trial).toBe('Start the trial');
  });

  it('keeps no "free" in any chip or button label', () => {
    for (const label of [...Object.values(KIND_CHIP_LABELS), ...Object.values(CTA_LABELS)]) {
      expect(label).not.toMatch(/free/i);
    }
  });
});

describe('ctaConditions', () => {
  const base = { requiresCard: false } as const;

  it('states the postage next to a sample button', () => {
    expect(ctaConditions({ ...base, offerType: 'free_sample', postage: { kind: 'free' } })).toBe(
      'Postage: free.'
    );
    expect(
      ctaConditions({
        ...base,
        offerType: 'free_sample',
        postage: { kind: 'cost', amountMinor: 299, currency: 'GBP' },
      })
    ).toBe('Postage: £2.99.');
    expect(
      ctaConditions({ ...base, offerType: 'free_sample', postage: { kind: 'check_terms' } })
    ).toBe("Postage: check the brand's terms.");
  });

  it('states the card requirement next to a trial button, and nothing when no card is needed', () => {
    expect(
      ctaConditions({ offerType: 'free_trial', postage: { kind: 'free' }, requiresCard: true })
    ).toBe('A payment card is required to start.');
    expect(
      ctaConditions({ offerType: 'free_trial', postage: { kind: 'free' }, requiresCard: false })
    ).toBeNull();
  });

  it.each(['cashback', 'voucher', 'competition'] as const)('adds no line for %s', (offerType) => {
    expect(ctaConditions({ ...base, offerType, postage: { kind: 'free' } })).toBeNull();
  });
});
