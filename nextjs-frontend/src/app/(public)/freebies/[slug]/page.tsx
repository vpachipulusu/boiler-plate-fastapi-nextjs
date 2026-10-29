import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/offer/breadcrumbs';
import { ClaimSteps } from '@/components/offer/claim-steps';
import { ImportantBits } from '@/components/offer/important-bits';
import { OfferHero } from '@/components/offer/offer-hero';
import { RelatedOffers } from '@/components/offer/related-offers';
import { JsonLd } from '@/components/seo/json-ld';
import {
  getCategoryBySlug,
  getLiveOffers,
  getMerchantBySlug,
  getMerchants,
  getOfferBySlug,
  getRelatedOffers,
  getToday,
  isLive,
  type Offer,
} from '@/lib/catalogue';
import { expiredIndexingPolicy } from '@/lib/seo/indexing';
import { buildBreadcrumbList } from '@/lib/seo/json-ld';
import { offerRobots, openGraphFor } from '@/lib/seo/metadata';

/** Re-rendered at most hourly so an offer that has just ended shows its ended state and noindex. */
export const revalidate = 3600;

interface OfferPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const offers = await getLiveOffers();
  return offers.map((offer) => ({ slug: offer.slug }));
}

/**
 * An API-backed offer more than 30 days past its end date is gone (policy: 410). Next.js cannot
 * set a 410 from a page, so it answers 404 via `notFound()` until Phase 3 adds a real 410; see
 * docs/developer/freejoy-seo.md. Fixture offers keep rendering so the design preview stays intact.
 */
function isGone(offer: Offer, today: string): boolean {
  return offer.source === 'api' && expiredIndexingPolicy(offer, today).state === 'gone';
}

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [offer, today] = await Promise.all([getOfferBySlug(slug), getToday()]);
  if (!offer || isGone(offer, today)) return { title: 'Offer not found', robots: { index: false } };
  const path = `/freebies/${offer.slug}`;
  return {
    title: offer.title,
    description: offer.summary,
    alternates: { canonical: path },
    openGraph: openGraphFor({
      title: offer.title,
      description: offer.summary,
      path,
      type: 'article',
    }),
    // Indexable only for a live API offer; ended offers are noindex, follow (see lib/seo).
    robots: offerRobots(offer, today),
  };
}

export default async function OfferPage({ params }: OfferPageProps) {
  const { slug } = await params;
  const offer = await getOfferBySlug(slug);
  if (!offer) notFound();

  const [merchant, category, related, merchants, today] = await Promise.all([
    getMerchantBySlug(offer.merchantSlug),
    getCategoryBySlug(offer.categorySlug),
    getRelatedOffers(offer, 4),
    getMerchants(),
    getToday(),
  ]);
  if (!merchant || !category || isGone(offer, today)) notFound();

  const ended = !isLive(offer, today);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-10">
      <JsonLd
        data={buildBreadcrumbList([
          { name: 'Home', path: '/' },
          { name: category.name, path: `/category/${category.slug}` },
          { name: offer.title, path: `/freebies/${offer.slug}` },
        ])}
      />
      <Breadcrumbs category={category} offer={offer} />
      <div className="mt-6 space-y-12 sm:mt-8 sm:space-y-16">
        <OfferHero offer={offer} merchant={merchant} category={category} ended={ended} />
        <ClaimSteps steps={offer.steps} />
        <ImportantBits offer={offer} />
        <RelatedOffers offers={related} merchants={merchants} category={category} />
      </div>
    </div>
  );
}
