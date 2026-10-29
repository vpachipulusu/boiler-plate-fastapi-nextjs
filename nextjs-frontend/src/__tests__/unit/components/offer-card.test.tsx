import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfferCard, OfferGrid } from '@/components/catalogue/offer-card';
import { MERCHANTS, OFFERS } from '@/lib/catalogue/fixtures';

const offer = OFFERS[0];
const merchant = MERCHANTS.find((item) => item.slug === offer.merchantSlug)!;

describe('OfferCard', () => {
  it('links the title to the offer page and labels the offer kind honestly', () => {
    render(<OfferCard offer={offer} merchant={merchant} />);

    expect(screen.getByRole('link', { name: offer.title })).toHaveAttribute(
      'href',
      `/freebies/${offer.slug}`
    );
    expect(screen.getByText(merchant.name)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: offer.image.alt })).toBeInTheDocument();
  });

  it('shows the demo badge on fixture offers and never links off-site', () => {
    const { container } = render(<OfferCard offer={offer} merchant={merchant} />);

    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(container.querySelector('a[href^="http"]')).toBeNull();
  });
});

describe('OfferGrid', () => {
  it('renders one list item per offer', () => {
    render(<OfferGrid offers={OFFERS.slice(0, 4)} merchants={MERCHANTS} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});
