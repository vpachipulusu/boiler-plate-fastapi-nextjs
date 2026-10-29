import Link from 'next/link';
import { Spark } from '@/components/site/brand-mark';

/**
 * Mint sign-up band. A plain GET form: submitting only navigates to /alerts?email=..., where the
 * alerts page owns the real (demo) flow. Nothing is saved here and the copy never says it was.
 */
export function NewsletterBand() {
  return (
    <section
      aria-labelledby="newsletter-heading"
      className="relative mt-12 overflow-hidden rounded-editorial bg-good px-6 py-8 sm:px-10 sm:py-10 lg:px-12"
    >
      <Spark className="absolute right-[18%] top-3 hidden h-8 w-8 text-cta lg:block" />
      <div className="grid items-center gap-6 lg:grid-cols-2">
        <div>
          <h2
            id="newsletter-heading"
            className="font-display text-2xl font-extrabold tracking-tight text-good-foreground sm:text-3xl"
          >
            Make your inbox a happier place.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            A regular edit of fresh freebies. No spam, just the good stuff.
          </p>
        </div>
        <div>
          <form method="get" action="/alerts" className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Your email address
            </label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Your email address"
              className="min-h-12 w-full flex-1 rounded-input border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-cta px-6 text-base font-bold text-cta-foreground shadow-sm hover:bg-cta-hover"
            >
              Get free alerts
            </button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            No spam. Unsubscribe anytime. See{' '}
            <Link href="/privacy" className="font-semibold underline">
              privacy details
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
