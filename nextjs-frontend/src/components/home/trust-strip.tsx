import { Check } from 'lucide-react';

/** Site intentions, not metrics: no counts, dates, absolutes or verification claims belong here. */
const SHARED_ITEMS = [
  { title: 'Terms in plain words', detail: 'Postage, eligibility and card needs on each listing' },
  { title: 'UK offers', detail: 'Samples, trials, cashback, vouchers and competitions' },
  { title: 'Clear labels', detail: 'Cashback and vouchers are labelled for what they are' },
] as const;

const DEMO_ITEM = { title: 'Design preview', detail: 'Sample listings, not live offers' } as const;
const LIVE_ITEM = {
  title: 'Read the terms',
  detail: 'Offers can change at the provider, so check before you claim',
} as const;

export function TrustStrip({ demo }: { demo: boolean }) {
  const items = [...SHARED_ITEMS, demo ? DEMO_ITEM : LIVE_ITEM];
  return (
    <section aria-label="How we list offers" className="border-b border-border py-6">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-good text-good-foreground">
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
