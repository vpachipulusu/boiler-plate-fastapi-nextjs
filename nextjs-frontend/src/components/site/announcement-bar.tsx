import { Spark } from './brand-mark';

/**
 * Mint strip above the header (design screens 01-07). Static copy: no countdown, no urgency, and no claim
 * that everything costs nothing (cashback, vouchers, postage and card trials are listed too).
 */
export function AnnouncementBar() {
  return (
    <div className="bg-accent text-accent-ink">
      <p className="mx-auto flex max-w-content items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide sm:text-sm sm:normal-case sm:tracking-normal">
        <Spark className="hidden h-3.5 w-3.5 sm:block" />
        <span className="sm:hidden">Good stuff. Terms upfront.</span>
        <span className="hidden sm:inline">
          UK samples, trials and offers, with the terms in plain words.
        </span>
      </p>
    </div>
  );
}
