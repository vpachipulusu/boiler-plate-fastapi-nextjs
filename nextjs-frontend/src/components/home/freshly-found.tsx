import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { OfferGrid } from '@/components/catalogue/offer-card';
import type { Merchant, Offer } from '@/lib/catalogue';

interface FreshlyFoundProps {
  offers: Offer[];
  merchants: Merchant[];
}

export function FreshlyFound({ offers, merchants }: FreshlyFoundProps) {
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
          <p className="mt-1 text-sm text-muted-foreground">These new offers are worth a look.</p>
        </div>
        <Link
          href="/freebies"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-accent-ink hover:underline"
        >
          See all freebies
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Sample listings for the design preview, not real offers.
      </p>
      <OfferGrid offers={offers} merchants={merchants} className="mt-5" />
    </section>
  );
}
