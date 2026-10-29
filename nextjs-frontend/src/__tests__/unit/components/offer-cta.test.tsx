import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfferCta } from '@/components/offer/offer-cta';

describe('OfferCta', () => {
  it('opens the demo offer dialog when the call to action is clicked', async () => {
    const user = userEvent.setup();
    render(<OfferCta offerType="free_sample" ended={false} categorySlug="beauty" demo />);

    await user.click(screen.getByRole('button', { name: /get this free sample/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Demo offer' });
    expect(dialog).toHaveTextContent(/design preview with sample data/i);
    expect(dialog).toHaveTextContent(/nothing was clicked through/i);
  });

  it('closes on Escape and returns focus to the call to action', async () => {
    const user = userEvent.setup();
    render(<OfferCta offerType="free_trial" ended={false} categorySlug="beauty" demo />);
    const trigger = screen.getByRole('button', { name: /start the free trial/i });

    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Demo offer' });
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('labels the button by offer type and never links to an external site', () => {
    render(<OfferCta offerType="competition" ended={false} categorySlug="home-cleaning" demo />);

    expect(screen.getByRole('button', { name: /enter this competition/i })).toBeInTheDocument();
    expect(screen.getByText(/to request your entry/i)).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^https?:/);
    }
    expect(screen.getByRole('link', { name: /affiliate disclosure/i })).toHaveAttribute(
      'href',
      '/affiliate-disclosure'
    );
  });

  it('replaces the button with an ended panel that links onward', () => {
    render(<OfferCta offerType="free_sample" ended categorySlug="home-cleaning" demo />);

    expect(screen.getByRole('heading', { name: 'This offer has ended' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: /more in this category/i })).toHaveAttribute(
      'href',
      '/category/home-cleaning'
    );
    expect(screen.getByRole('link', { name: /browse all freebies/i })).toHaveAttribute(
      'href',
      '/freebies'
    );
  });
});
