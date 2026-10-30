import { FRESHNESS_LABELS, type Freshness, type Offer } from './types';

/**
 * Labels that read as popularity or urgency claims (CAP 3.7, 3.30; docs/compliance/uk-affiliate-checklist.md
 * C1, C2). An editor can set them without any evidence behind them, so only a demo fixture may show them.
 */
const UNEVIDENCED_LABELS: ReadonlySet<Freshness> = new Set(['popular', 'ends_soon', 'limited']);

/**
 * The freshness label a card may show, or null. A real (API) offer never shows an editor-set popularity or
 * urgency label: it needs a documented rule first (C1 computes "Ends soon" from the real end date). A demo
 * fixture keeps them, because the demo badge already says the listing is a sample.
 */
export function displayFreshness(
  offer: Pick<Offer, 'freshness' | 'source' | 'demo'>
): string | null {
  const { freshness } = offer;
  if (freshness === null) return null;
  if (UNEVIDENCED_LABELS.has(freshness) && !(offer.source === 'fixture' && offer.demo)) return null;
  return FRESHNESS_LABELS[freshness];
}
