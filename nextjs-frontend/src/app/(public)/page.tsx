import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { OfferGrid } from '@/components/catalogue/offer-card';
import { getFeaturedOffers, getMerchants } from '@/lib/catalogue';

/**
 * Foundation placeholder for the homepage. FREEJ-10 replaces this with the full hero, trust strip,
 * category grid, "Freshly found" section and newsletter band from design screens 01/05.
 */
export default async function HomePage() {
  const [offers, merchants] = await Promise.all([getFeaturedOffers(8), getMerchants()]);

  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <section className="rounded-editorial bg-secondary px-6 py-12 sm:px-10 sm:py-16">
        <p className="inline-flex rounded-pill bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
          The good stuff, no spend
        </p>
        <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl sm:leading-[1.1]">
          Small treats. Big free energy.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Discover genuinely good freebies, samples and offers from brands you&apos;ll actually
          love. All in one happy place.
        </p>
        <Link
          href="/freebies"
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-pill bg-cta px-6 text-base font-bold text-cta-foreground shadow-sm hover:bg-cta-hover"
        >
          Explore freebies
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-12" aria-labelledby="freshly-found">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="freshly-found" className="font-display text-3xl font-extrabold tracking-tight">
              Freshly found
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sample listings for the design preview. Not real offers.
            </p>
          </div>
          <Link
            href="/freebies"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-accent-ink hover:underline"
          >
            See all freebies
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <OfferGrid offers={offers} merchants={merchants} className="mt-6" />
      </section>
    </div>
  );
}
