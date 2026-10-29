import { cache } from 'react';
import { InlineError } from '@/components/catalogue/inline-error';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getCategories,
  getFeaturedOffers,
  getMerchants,
  settle,
  type Category,
  type Loaded,
  type Merchant,
  type Offer,
} from '@/lib/catalogue';
import { CategoryGrid } from './category-grid';
import { FreshlyFound } from './freshly-found';

const FEATURED_COUNT = 8;

interface HomeData {
  categories: Category[];
  offers: Offer[];
  merchants: Merchant[];
}

/**
 * The catalogue data the home page shows. Memoised per request so `generateMetadata` (which marks an
 * error page noindex) and the sections below share one set of reads.
 */
export const loadHomeData = cache(async (): Promise<Loaded<HomeData>> => {
  const loaded = await settle(
    Promise.all([getCategories(), getFeaturedOffers(FEATURED_COUNT), getMerchants()])
  );
  if (!loaded.ok) return loaded;
  const [categories, offers, merchants] = loaded.data;
  return { ok: true, data: { categories, offers, merchants } };
});

/** Category grid and featured offers, or the error state when the catalogue cannot be read. */
export async function HomeSections({ demo }: { demo: boolean }) {
  const home = await loadHomeData();
  if (!home.ok) return <InlineError className="mt-10" />;
  return (
    <>
      <CategoryGrid categories={home.data.categories} />
      <FreshlyFound offers={home.data.offers} merchants={home.data.merchants} demo={demo} />
    </>
  );
}

/** Fallback while the catalogue loads: shaped like the two sections so nothing jumps. */
export function HomeSectionsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading freebies" className="pt-10">
      <span className="sr-only">Loading freebies</span>
      <Skeleton className="h-8 w-64" />
      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-card" />
        ))}
      </div>
      <Skeleton className="mt-12 h-8 w-48" />
      <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index}>
            <Skeleton className="aspect-[4/3] w-full rounded-card" />
            <Skeleton className="mt-4 h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
