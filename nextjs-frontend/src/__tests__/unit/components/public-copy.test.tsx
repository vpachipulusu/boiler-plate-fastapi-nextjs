import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// FREEJ-30: public copy must match what the site does today (docs/compliance/uk-affiliate-checklist.md,
// section I.2). These pin the wording the compliance review flagged so it cannot creep back.

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { AnnouncementBar } from '@/components/site/announcement-bar';
import { SiteFooter } from '@/components/site/site-footer';
import { HomeHero } from '@/components/home/home-hero';
import { TrustStrip } from '@/components/home/trust-strip';
import { CatalogueHeader } from '@/components/catalogue/catalogue-header';
import { OfferCta } from '@/components/offer/offer-cta';
import { OfferTrustPanel } from '@/components/offer/offer-trust-panel';
import { siteConfig } from '@/config/site';
import { DEFAULT_QUERY } from '@/lib/catalogue/offer-url';
import { OFFERS } from '@/lib/catalogue/fixtures';

const ABSOLUTES = /zero spend|for £0|no spend|genuine|daily dose|hidden surprises|freebies only/i;
const SAMPLE = OFFERS.find((offer) => offer.offerType === 'free_sample')!;

describe('site-wide slogans', () => {
  it('announcement bar does not say everything costs nothing or refreshes daily', () => {
    const { container } = render(<AnnouncementBar />);

    expect(container.textContent).not.toMatch(ABSOLUTES);
    expect(container.textContent).not.toMatch(/daily|£0/i);
    expect(container.textContent).toMatch(/terms/i);
  });

  it('the tagline and description (footer, metadata, manifest) make no zero-cost or quality claim', () => {
    expect(siteConfig.tagline).not.toMatch(ABSOLUTES);
    expect(siteConfig.description).not.toMatch(ABSOLUTES);
    render(<SiteFooter />);
    expect(screen.getByText(new RegExp(siteConfig.tagline.replace('.', '\.')))).toBeInTheDocument();
  });

  it.each([true, false])('the home hero makes no zero-cost or quality claim (demo=%s)', (demo) => {
    const { container } = render(<HomeHero demo={demo} />);

    expect(container.textContent).not.toMatch(ABSOLUTES);
  });

  it('the trust strip describes every offer type and makes no absolute promise', () => {
    render(<TrustStrip demo={false} />);

    const strip = screen.getByRole('region', { name: /how we list offers/i });
    expect(strip.textContent).not.toMatch(ABSOLUTES);
    expect(strip.textContent).toMatch(/cashback/i);
    expect(strip.textContent).toMatch(/vouchers/i);
  });

  it('the catalogue header does not call every listing free', () => {
    const { container } = render(<CatalogueHeader query={DEFAULT_QUERY} demo={false} />);

    expect(container.textContent).not.toMatch(/free thing/i);
  });
});

describe('offer trust panel date', () => {
  it('calls a demo date a sample date and never says it was checked', () => {
    const { container } = render(<OfferTrustPanel offer={{ ...SAMPLE, demo: true }} />);

    expect(screen.getByText(/^Sample date \d/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/last checked/i);
    expect(container.textContent).toMatch(/has not checked this offer/i);
    expect(screen.getByRole('region', { name: 'Offer details' })).toBeInTheDocument();
  });

  it('shows "Last checked" for a real offer only', () => {
    const { container } = render(
      <OfferTrustPanel offer={{ ...SAMPLE, demo: false, source: 'api' }} />
    );

    expect(screen.getByText(/^Last checked \d/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/sample date|has not checked/i);
    expect(screen.getByRole('region', { name: 'Offer checks' })).toBeInTheDocument();
  });
});

describe('call to action conditions line', () => {
  it('shows the generated line after a demo button', () => {
    render(<OfferCta offerType="free_sample" demo conditions="Postage: £2.99." />);

    expect(screen.getByText('Postage: £2.99.')).toBeInTheDocument();
  });

  it('shows the generated line after a real offer button, before the commission sentence', () => {
    const { container } = render(
      <OfferCta
        offerType="free_trial"
        demo={false}
        offerId="api-1"
        conditions="A payment card is required to start."
      />
    );

    const text = container.textContent ?? '';
    expect(text.indexOf('Start the trial')).toBeLessThan(
      text.indexOf('A payment card is required')
    );
    expect(text.indexOf('A payment card is required')).toBeLessThan(
      text.indexOf('Freejoy is paid')
    );
  });

  it('adds nothing when there is no line', () => {
    const { container } = render(<OfferCta offerType="cashback" demo />);

    expect(container.textContent).not.toMatch(/postage:|payment card/i);
  });

  it('the demo disclosure line no longer hedges about earning commission "if you qualify"', () => {
    const { container } = render(<OfferCta offerType="voucher" demo />);

    expect(container.textContent).not.toMatch(/may earn|if you qualify/i);
    expect(container.textContent).toMatch(/Ad/);
  });
});
