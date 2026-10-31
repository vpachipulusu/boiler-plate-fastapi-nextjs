import type { Metadata } from 'next';
import { AlertsForm } from '@/components/alerts/alerts-form';
import { InlineError } from '@/components/catalogue/inline-error';
import { Spark } from '@/components/site/brand-mark';
import { isAlertsFormLive } from '@/lib/alerts/live';
import { getCategories, settle } from '@/lib/catalogue';
import { listingRobots, openGraphFor } from '@/lib/seo/metadata';

/**
 * Alerts are open only when ALERTS_FORM_LIVE=true is set (server-only, read on each request through
 * `isAlertsFormLive`, so the About page agrees). Set it once a real email provider is configured in
 * production (ADR-012). Until then the page shows a plain "not open yet" notice instead of the form, does not
 * load the categories, stays noindex, and the backend refuses sign-ups as a last line.
 */

const ALERTS_TITLE = 'Free alerts';
const ALERTS_DESCRIPTION =
  'Choose the freebie categories you care about and how often you want to hear about them.';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: ALERTS_TITLE,
    description: ALERTS_DESCRIPTION,
    alternates: { canonical: '/alerts' },
    openGraph: openGraphFor({
      title: ALERTS_TITLE,
      description: ALERTS_DESCRIPTION,
      path: '/alerts',
    }),
    robots: listingRobots({ indexable: isAlertsFormLive() }),
  };
}

// Dynamic, like the other catalogue pages: a build never reaches the catalogue, and a request that cannot
// reach it shows an error instead of failing the page.
export const dynamic = 'force-dynamic';

/** No query string is read: an address must never travel in a page address, so nothing is prefilled. */
export default async function AlertsPage() {
  const live = isAlertsFormLive();
  // Closed: the form shows only its notice, so there is nothing to load and a catalogue outage cannot hide it.
  const categories = live ? await settle(getCategories()) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
      <div className="overflow-hidden rounded-editorial border border-border bg-card lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <section aria-labelledby="alerts-promise" className="bg-good px-6 py-10 sm:px-10 sm:py-12">
          <Spark className="h-14 w-14 text-cta" />
          <h1
            id="alerts-promise"
            className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl"
          >
            Good things. Straight to you.
          </h1>
          <p className="mt-5 max-w-sm text-base text-muted-foreground">
            Fresh finds, useful reminders and only the categories you actually care about.
          </p>
          <div aria-hidden="true" className="mt-10 flex justify-center">
            <div className="flex h-56 w-56 items-center justify-center rounded-full bg-accent-ink/10 sm:h-72 sm:w-72">
              <div className="w-36 rounded-card bg-card p-2 shadow-sm">
                <div className="rounded-input bg-background p-2 text-center">
                  <div className="flex h-16 items-center justify-center rounded-md bg-cta text-white">
                    <Spark className="h-8 w-8" />
                  </div>
                  <p className="mt-3 font-display text-sm font-extrabold text-foreground">
                    a little joy
                  </p>
                  <p className="mb-1 text-[11px] font-bold text-muted-foreground">in your inbox</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="px-6 py-10 sm:px-10 sm:py-12">
          {categories === null ? (
            <AlertsForm categories={[]} live={false} />
          ) : categories.ok ? (
            <AlertsForm
              categories={categories.data.map(({ slug, name }) => ({ slug, name }))}
              live
            />
          ) : (
            <InlineError
              title="The alerts form is not loading"
              message="We could not load the categories for your alerts. Please try again in a moment."
            />
          )}
        </section>
      </div>
    </div>
  );
}
