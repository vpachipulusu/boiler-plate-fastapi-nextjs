/** Small builders that turn the indexing helpers into Next.js metadata fragments. */
import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import type { Offer } from '@/lib/catalogue/types';
import { expiredIndexingPolicy, isIndexableOffer } from './indexing';

type Robots = NonNullable<Metadata['robots']>;
type OpenGraph = NonNullable<Metadata['openGraph']>;

/** Indexable pages repeat the root layout's snippet/preview allowances (page robots replace it). */
export const INDEXABLE_ROBOTS: Robots = {
  index: true,
  follow: true,
  'max-image-preview': 'large',
  'max-snippet': -1,
  'max-video-preview': -1,
};

/** Not indexable; `follow` is left at the crawler default. */
export const NOINDEX_ROBOTS: Robots = { index: false };

/** Not indexable, but the links on the page may be followed (refinements, ended offers). */
export const NOINDEX_FOLLOW_ROBOTS: Robots = { index: false, follow: true };

/**
 * Robots for a listing page (home, /freebies, a category). A refined view (filter, search, sort or
 * page > 1) is always `noindex, follow`; the plain view follows `indexable`.
 */
export function listingRobots(options: { indexable: boolean; refined?: boolean }): Robots {
  if (options.refined) return NOINDEX_FOLLOW_ROBOTS;
  return options.indexable ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS;
}

/** Robots for an offer page: the data decides while live, the expiry policy takes over after. */
export function offerRobots(offer: Offer, today: string): Robots {
  const policy = expiredIndexingPolicy(offer, today);
  if (policy.noindex) return NOINDEX_FOLLOW_ROBOTS;
  return isIndexableOffer(offer, today) ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS;
}

/** Open Graph block for a page. The canonical path becomes the `og:url`. */
export function openGraphFor(options: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}): OpenGraph {
  return {
    type: options.type ?? 'website',
    locale: 'en_GB',
    siteName: siteConfig.name,
    title: options.title,
    description: options.description,
    url: options.path,
  };
}
