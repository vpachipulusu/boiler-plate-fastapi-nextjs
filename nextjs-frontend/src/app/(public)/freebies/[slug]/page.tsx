import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/offer/breadcrumbs';
import { ClaimSteps } from '@/components/offer/claim-steps';
import { ImportantBits } from '@/components/offer/important-bits';
import { OfferHero } from '@/components/offer/offer-hero';
import { RelatedOffers } from '@/components/offer/related-offers';
import {
  getCategoryBySlug,
  getLiveOffers,
  getMerchantBySlug,
  getMerchants,
  getOfferBySlug,
  getRelatedOffers,
  getToday,
} from '@/lib/catalogue';
import { isLive } from '@/lib/catalogue/query';

interface OfferPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const offers = await getLiveOffers();
  return offers.map((offer) => ({ slug: offer.slug }));
}

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  const offer = await getOfferBySlug(slug);
  if (!offer) return { title: 'Offer not found', robots: { index: false } };
  return {
    title: offer.title,
    description: offer.summary,
    alternates: { canonical: `/freebies/${offer.slug}` },
    openGraph: { title: offer.title, description: offer.summary, type: 'article' },
    // Fixture-backed demo content stays out of search engines until real offers replace it.
    robots: { index: false },
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
  if (!merchant || !category) notFound();

  const ended = !isLive(offer, today);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-10">
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
