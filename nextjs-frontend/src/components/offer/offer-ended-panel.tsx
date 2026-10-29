import Link from 'next/link';
import { CalendarOff } from 'lucide-react';
import { formatIsoDate } from './offer-format';

interface OfferEndedPanelProps {
  categorySlug: string;
  /** Europe/London date the offer ended (YYYY-MM-DD), when the catalogue knows it. */
  endedAt?: string | null;
}

/** The calm "This offer has ended" panel with two ways onward. Replaces the call to action. */
export function OfferEndedPanel({ categorySlug, endedAt = null }: OfferEndedPanelProps) {
  return (
    <section aria-labelledby="offer-ended-heading" className="rounded-card bg-warn p-5">
      <h2
        id="offer-ended-heading"
        className="flex items-center gap-2 font-display text-lg font-bold text-warn-foreground"
      >
        <CalendarOff className="h-5 w-5" aria-hidden="true" />
        This offer has ended
      </h2>
      <p className="mt-2 text-sm text-warn-foreground">
        {endedAt ? `It ended on ${formatIsoDate(endedAt)}. ` : ''}The provider is no longer
        accepting requests for this one. There are plenty of other happy finds to explore.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold">
        <Link
          href={`/category/${categorySlug}`}
          className="inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline"
        >
          More in this category
        </Link>
        <Link
          href="/freebies"
          className="inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline"
        >
          Browse all freebies
        </Link>
      </div>
    </section>
  );
}
