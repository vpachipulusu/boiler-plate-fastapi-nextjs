import { Check } from 'lucide-react';

/** Site promises, not metrics: no counts and no dates belong here. */
const TRUST_ITEMS = [
  { title: 'Hand-checked offers', detail: 'Clear terms before you click' },
  { title: 'UK freebies only', detail: 'Relevant local offers' },
  { title: 'No hidden surprises', detail: 'Postage shown upfront' },
  { title: 'Updated regularly', detail: 'New finds worth opening' },
] as const;

export function TrustStrip() {
  return (
    <section aria-label="Our promises" className="border-b border-border py-6">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        {TRUST_ITEMS.map((item) => (
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
