import { OfferGrid } from '@/components/catalogue/offer-card';
import type { Category, Merchant, Offer } from '@/lib/catalogue/types';

interface RelatedOffersProps {
  offers: Offer[];
  merchants: Merchant[];
  category: Category;
}

export function RelatedOffers({ offers, merchants, category }: RelatedOffersProps) {
  if (offers.length === 0) return null;
  return (
    <section aria-labelledby="related-heading">
      <h2
        id="related-heading"
        className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
      >
        You might also love
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        More happy finds from the {category.shortName.toLowerCase()} edit.
      </p>
      <OfferGrid offers={offers} merchants={merchants} className="mt-6" />
    </section>
  );
}
