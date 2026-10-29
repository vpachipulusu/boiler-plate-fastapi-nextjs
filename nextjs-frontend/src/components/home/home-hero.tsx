import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HomeHeroArt } from './home-hero-art';

/** Cream editorial hero (design screens 01/05): copy and two pills, illustration on the right. */
export function HomeHero() {
  return (
    <section
      aria-labelledby="home-hero-heading"
      className="overflow-hidden rounded-editorial bg-secondary px-5 py-8 sm:px-10 sm:py-12 lg:px-14"
    >
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-pill bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
            <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-accent-ink" />
            The good stuff, no spend
          </p>
          <h1
            id="home-hero-heading"
            className="mt-5 font-display text-[clamp(2.25rem,5vw+1rem,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground"
          >
            Small treats.
            <br />
            Big free energy.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
            Discover genuinely good freebies, samples and offers from brands you&apos;ll actually
            love. All in one happy place.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/freebies"
              className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-cta px-6 text-base font-bold text-cta-foreground shadow-sm hover:bg-cta-hover"
            >
              Explore freebies
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/about#how-it-works"
              className="inline-flex min-h-12 items-center rounded-pill border border-border bg-card px-6 text-base font-bold text-foreground hover:bg-background"
            >
              How it works
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs font-bold text-accent-ink">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-ink" />
            Design preview with sample listings
          </p>
        </div>
        <HomeHeroArt className="mx-auto w-4/5 max-w-sm lg:w-full lg:max-w-none" />
      </div>
    </section>
  );
}
