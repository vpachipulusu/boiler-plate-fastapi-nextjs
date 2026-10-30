import Link from 'next/link';
import { Spark } from '@/components/site/brand-mark';

/**
 * Mint sign-up band. It only links to /alerts, where the visitor picks categories, ticks consent and
 * starts the double opt-in. It collects no address itself, so none is ever put in a page address.
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
            Alerts about offers in the categories you choose.
          </p>
        </div>
        <div>
          <Link
            href="/alerts"
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-cta px-6 text-base font-bold text-cta-foreground shadow-sm hover:bg-cta-hover"
          >
            Get free alerts
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Only the alerts you choose. Unsubscribe from any email. See{' '}
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
