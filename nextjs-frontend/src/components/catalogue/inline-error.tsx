import { TriangleAlert } from 'lucide-react';
import { CATALOGUE_UNAVAILABLE_MESSAGE } from '@/lib/catalogue/errors';
import { cn } from '@/lib/utils';
import { RetryButton } from './retry-button';

interface InlineErrorProps {
  /** Curated copy only. Backend text never reaches the browser. */
  message?: string;
  title?: string;
  className?: string;
}

/**
 * The catalogue's error state: announced to screen readers (`role="alert"`), with a keyboard
 * reachable retry button. Shown in place of a list or page that could not be loaded.
 */
export function InlineError({
  title = 'The freebies are not loading',
  message = CATALOGUE_UNAVAILABLE_MESSAGE,
  className,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-card border border-destructive/50 bg-card p-5 text-foreground',
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-display text-base font-bold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <RetryButton />
    </div>
  );
}

/** A whole page in the error state: used when the page cannot name even its own heading. */
export function CatalogueUnavailablePage({ heading = 'Freebies' }: { heading?: string }) {
  return (
    <div className="mx-auto max-w-content px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {heading}
      </h1>
      <InlineError className="mt-8" />
    </div>
  );
}
