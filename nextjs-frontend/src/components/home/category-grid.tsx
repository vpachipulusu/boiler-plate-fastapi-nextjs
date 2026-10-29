import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Category, Tint } from '@/lib/catalogue';

/** Theme-token approximation of each fixture tint, so the badges follow the active theme. */
const TINT_BADGE: Record<Tint, string> = {
  blush: 'bg-cta/25',
  mint: 'bg-good',
  lavender: 'bg-primary/10',
  sky: 'bg-info',
  butter: 'bg-warn',
  cream: 'bg-secondary',
  sage: 'bg-accent-ink/15',
  sand: 'bg-muted',
};

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="category-heading" className="pt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="category-heading"
            className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            Whatever makes you smile
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a category and find your next little treat.
          </p>
        </div>
        <Link
          href="/freebies#categories"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-accent-ink hover:underline"
        >
          All categories
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-6">
        {categories.slice(0, 6).map((category) => (
          <li key={category.slug} className="flex">
            <Link
              href={`/category/${category.slug}`}
              className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-2 rounded-card border border-border bg-card p-3 text-center text-sm font-bold text-foreground shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left"
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-accent-ink ${TINT_BADGE[category.tint]}`}
              >
                {category.shortName.charAt(0).toUpperCase()}
              </span>
              {category.shortName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
