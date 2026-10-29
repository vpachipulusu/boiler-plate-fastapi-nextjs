import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/app/globals.css', () => ({}));

import HomePage, { metadata as homeMetadata } from '@/app/(public)/page';
import AboutPage, { metadata as aboutMetadata } from '@/app/(public)/about/page';
import PrivacyPage, { metadata as privacyMetadata } from '@/app/(public)/privacy/page';
import CookiesPage, { metadata as cookiesMetadata } from '@/app/(public)/cookies/page';
import TermsPage, { metadata as termsMetadata } from '@/app/(public)/terms/page';
import AffiliatePage, {
  metadata as affiliateMetadata,
} from '@/app/(public)/affiliate-disclosure/page';

const DRAFT_BANNER = 'Draft — placeholder text pending legal review';

const LEGAL_PAGES = [
  { name: 'privacy', Page: PrivacyPage, metadata: privacyMetadata },
  { name: 'cookies', Page: CookiesPage, metadata: cookiesMetadata },
  { name: 'terms', Page: TermsPage, metadata: termsMetadata },
  { name: 'affiliate disclosure', Page: AffiliatePage, metadata: affiliateMetadata },
];

async function renderHome() {
  return render(await HomePage());
}

describe('homepage', () => {
  it('shows the display heading as the only h1', async () => {
    await renderHome();

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/small treats\.\s*big free energy\./i);
  });

  it('links each of the six categories to its category page', async () => {
    const { container } = await renderHome();

    const links = container.querySelectorAll('a[href^="/category/"]');
    expect(links).toHaveLength(6);
  });

  it('shows eight offer cards under "Freshly found" with the sample-listing note', async () => {
    await renderHome();

    const section = screen.getByRole('region', { name: /freshly found/i });
    expect(within(section).getAllByRole('article')).toHaveLength(8);
    expect(
      within(section).getByText(/sample listings for the design preview/i)
    ).toBeInTheDocument();
  });

  it('offers the hero CTAs to /freebies and the how-it-works anchor', async () => {
    await renderHome();

    expect(screen.getByRole('link', { name: 'Explore freebies' })).toHaveAttribute(
      'href',
      '/freebies'
    );
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/about#how-it-works'
    );
  });

  it('describes freshness as regular and uses no counts in the trust strip', async () => {
    const { container } = await renderHome();

    expect(screen.getByText('Design preview with sample listings')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/every day|daily dose|checked daily/i);
    const strip = screen.getByRole('region', { name: /our promises/i });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(4);
    expect(strip.textContent).not.toMatch(/\d/);
  });

  it('submits the alerts form with GET to /alerts and a labelled email field', async () => {
    const { container } = await renderHome();

    const form = container.querySelector('form') as HTMLFormElement;
    expect(form).toHaveAttribute('action', '/alerts');
    expect(form.method).toBe('get');
    const email = screen.getByLabelText('Your email address');
    expect(email).toHaveAttribute('name', 'email');
    expect(email).toHaveAttribute('type', 'email');
    expect(within(form).getByRole('button', { name: 'Get free alerts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy details' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('contains no external links', async () => {
    const { container } = await renderHome();

    expect(container.querySelectorAll('a[href^="http"]')).toHaveLength(0);
  });

  it('sets the canonical url and title in metadata', () => {
    expect(homeMetadata.title).toBe('Freejoy – UK freebies, samples and offers');
    expect(homeMetadata.robots).toEqual({ index: false });
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });
});

describe.each(LEGAL_PAGES)('$name page', ({ Page, metadata }) => {
  it('shows the draft banner, an h1 and the reviewer checklist', () => {
    render(<Page />);

    expect(screen.getByText(DRAFT_BANNER)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'For the reviewer to confirm' })
    ).toBeInTheDocument();
  });

  it('is kept out of search engines while draft', () => {
    expect(metadata.robots).toEqual({ index: false });
  });

  it('contains no external links', () => {
    const { container } = render(<Page />);

    expect(container.querySelectorAll('a[href^="http"]')).toHaveLength(0);
  });
});

describe('cookies page', () => {
  it('states the intention to set no non-essential cookies, pending review', () => {
    render(<CookiesPage />);

    expect(
      screen.getByText(/intended to set no non-essential cookies and run no analytics/i)
    ).toBeInTheDocument();
  });
});

describe('affiliate disclosure page', () => {
  it('says links may earn a commission at no cost and never change terms', () => {
    render(<AffiliatePage />);

    expect(screen.getByText(/may earn a commission/i)).toBeInTheDocument();
    expect(screen.getByText(/costs you nothing extra/i)).toBeInTheDocument();
    expect(screen.getByText(/never changes the terms you get/i)).toBeInTheDocument();
    expect(screen.getByText(/editorial choice made independently/i)).toBeInTheDocument();
  });
});

describe('about page', () => {
  it('has the how-it-works anchor with three numbered steps', () => {
    const { container } = render(<AboutPage />);

    expect(screen.getByText(DRAFT_BANNER)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Freejoy');
    const anchor = container.querySelector('#how-it-works');
    expect(anchor).not.toBeNull();
    expect(anchor?.nextElementSibling?.tagName).toBe('OL');
    expect(anchor?.nextElementSibling?.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelectorAll('a[href^="http"]')).toHaveLength(0);
    expect(aboutMetadata.robots).toEqual({ index: false });
  });

  it('makes no claims about counts or verification stamps', () => {
    const { container } = render(<AboutPage />);

    expect(container.textContent).not.toMatch(/\d|verified by|guaranteed/i);
  });
});
