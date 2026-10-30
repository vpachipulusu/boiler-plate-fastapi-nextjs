import { describe, expect, it } from 'vitest';
import { displayFreshness } from '@/lib/catalogue/freshness';
import type { Freshness } from '@/lib/catalogue/types';

type Source = 'fixture' | 'api';

function show(freshness: Freshness | null, source: Source, demo = source === 'fixture') {
  return displayFreshness({ freshness, source, demo });
}

describe('displayFreshness', () => {
  it.each<Freshness>(['popular', 'ends_soon', 'limited'])(
    'never shows the editor-set %s label for a real (API) offer',
    (label) => {
      expect(show(label, 'api')).toBeNull();
    }
  );

  it.each<[Freshness, string]>([
    ['popular', 'Popular'],
    ['ends_soon', 'Ends soon'],
    ['limited', 'Limited'],
  ])('keeps %s for a demo fixture offer, where the demo badge shows', (label, text) => {
    expect(show(label, 'fixture')).toBe(text);
  });

  it('does not show a popularity or urgency label for a fixture offer that is not marked demo', () => {
    expect(show('popular', 'fixture', false)).toBeNull();
  });

  it('keeps the recency labels for real offers', () => {
    expect(show('new_today', 'api')).toBe('New today');
    expect(show('just_added', 'api')).toBe('Just added');
  });

  it('returns null when there is no label', () => {
    expect(show(null, 'api')).toBeNull();
    expect(show(null, 'fixture')).toBeNull();
  });
});
