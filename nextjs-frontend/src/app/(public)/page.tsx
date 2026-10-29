import type { Metadata } from 'next';
import { CategoryGrid } from '@/components/home/category-grid';
import { FreshlyFound } from '@/components/home/freshly-found';
import { HomeHero } from '@/components/home/home-hero';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { TrustStrip } from '@/components/home/trust-strip';
import { getCategories, getFeaturedOffers, getMerchants } from '@/lib/catalogue';

export const metadata: Metadata = {
  title: 'Freejoy – UK freebies, samples and offers',
  description:
    'Browse UK freebies, samples, trials and offers, with terms, postage and card requirements set out on every listing.',
  alternates: { canonical: '/' },
  // Fixture-backed design preview: nothing here is a real offer yet, so keep it out of search.
  robots: { index: false },
};

export default async function HomePage() {
  const [categories, offers, merchants] = await Promise.all([
    getCategories(),
    getFeaturedOffers(8),
    getMerchants(),
  ]);

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-6 lg:py-8">
      <HomeHero />
      <TrustStrip />
      <CategoryGrid categories={categories} />
      <FreshlyFound offers={offers} merchants={merchants} />
      <NewsletterBand />
    </div>
  );
}
