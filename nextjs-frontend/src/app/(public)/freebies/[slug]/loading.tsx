import { Skeleton } from '@/components/ui/skeleton';

/** Offer page loading state: the hero art and copy column, so the page does not jump when it arrives. */
export default function OfferLoading() {
  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-10">
      <div role="status" aria-busy="true" aria-label="Loading this freebie">
        <span className="sr-only">Loading this freebie</span>
        <Skeleton className="h-4 w-56 max-w-full" />
        <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <Skeleton className="aspect-[4/3] w-full rounded-editorial" />
          <div className="space-y-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-14 w-full rounded-pill" />
          </div>
        </div>
      </div>
    </div>
  );
}
