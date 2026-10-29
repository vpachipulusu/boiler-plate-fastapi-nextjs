import type { Metadata } from 'next';
import { AlertsForm } from '@/components/alerts/alerts-form';
import { Spark } from '@/components/site/brand-mark';
import { getCategories } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Free alerts',
  description:
    'Choose the freebie categories you care about and how often you want to hear about them.',
  alternates: { canonical: '/alerts' },
  robots: { index: false },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** Only a plausible address is prefilled; anything else (or a repeated param) is ignored. */
function prefillEmail(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return '';
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value) ? value : '';
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const [params, categories] = await Promise.all([searchParams, getCategories()]);

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
          <AlertsForm
            categories={categories.map(({ slug, name }) => ({ slug, name }))}
            defaultEmail={prefillEmail(params.email)}
          />
        </section>
      </div>
    </div>
  );
}
