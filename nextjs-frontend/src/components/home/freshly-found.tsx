import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { OfferGrid } from '@/components/catalogue/offer-card';
import type { Merchant, Offer } from '@/lib/catalogue';

interface FreshlyFoundProps {
  offers: Offer[];
  merchants: Merchant[];
  /** True when the offers are fixtures: the section says so. */
  demo: boolean;
}

export function FreshlyFound({ offers, merchants, demo }: FreshlyFoundProps) {
  return (
    <section aria-labelledby="freshly-found-heading" className="pt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="freshly-found-heading"
            className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            Freshly found
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {demo
              ? 'Featured picks from the sample catalogue.'
              : 'Featured picks from our latest finds.'}
          </p>
        </div>
        <Link
          href="/freebies"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-accent-ink hover:underline"
        >
          See all freebies
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {demo && (
        <p className="mt-2 text-xs text-muted-foreground">
          Sample listings for the design preview, not real offers.
        </p>
      )}
      {offers.length === 0 ? (
        <p className="mt-5 rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          There are no featured freebies right now. Browse all freebies to see what is available.
        </p>
      ) : (
        <OfferGrid offers={offers} merchants={merchants} className="mt-5" />
      )}
    </section>
  );
}
