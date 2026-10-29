import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/app/globals.css', () => ({}));

import HomePage, { generateMetadata as homeGenerateMetadata } from '@/app/(public)/page';
import AboutPage, { metadata as aboutMetadata } from '@/app/(public)/about/page';
import PrivacyPage, { metadata as privacyMetadata } from '@/app/(public)/privacy/page';
import CookiesPage, { metadata as cookiesMetadata } from '@/app/(public)/cookies/page';
import TermsPage, { metadata as termsMetadata } from '@/app/(public)/terms/page';
import AffiliatePage, {
  metadata as affiliateMetadata,
} from '@/app/(public)/affiliate-disclosure/page';
import { DRAFT_BANNER_TEXT } from '@/components/legal/legal-page';
import ContactPage, { metadata as contactMetadata } from '@/app/(public)/contact/page';

const DRAFT_BANNER = DRAFT_BANNER_TEXT;

const LEGAL_PAGES = [
  { name: 'privacy', Page: PrivacyPage, metadata: privacyMetadata },
  { name: 'cookies', Page: CookiesPage, metadata: cookiesMetadata },
  { name: 'terms', Page: TermsPage, metadata: termsMetadata },
  { name: 'affiliate disclosure', Page: AffiliatePage, metadata: affiliateMetadata },
];

/** Phrases that would claim compliance, registration or approval the site cannot yet back up. */
const COMPLIANCE_CLAIMS =
  /fully compliant|(gdpr|pecr|ico|asa|cma)[- ]compliant|compliant with|ico[- ]registered|registered with the ico|registration number|approved by|certified|verified by|guaranteed|completely free|100% free/i;

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

  it('links the sign-up band to /alerts without collecting an email address', async () => {
    const { container } = await renderHome();

    expect(screen.getByRole('link', { name: 'Get free alerts' })).toHaveAttribute(
      'href',
      '/alerts'
    );
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'privacy details' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('contains no external links', async () => {
    const { container } = await renderHome();

    expect(container.querySelectorAll('a[href^="http"]')).toHaveLength(0);
  });

  it('sets the canonical url and title in metadata', async () => {
    const homeMetadata = await homeGenerateMetadata();

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
  it('says plainly that nothing earns commission today', () => {
    render(<AffiliatePage />);

    expect(screen.getByText(/no commission can be earned/i)).toBeInTheDocument();
  });

  it('describes the redirect, paid-link marking and Ad label as planned, not live', () => {
    const { container } = render(<AffiliatePage />);

    expect(screen.getByText(/none of this is live yet/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/marked as a paid link for search engines/i);
    expect(container.textContent).toMatch(/“Ad”/);
    expect(container.textContent).toMatch(/pay Freejoy a commission/i);
    expect(container.textContent).not.toMatch(/rel=|sponsored nofollow/i);
  });

  it('does not state affiliate links exist or hedge with "may earn"', () => {
    const { container } = render(<AffiliatePage />);

    expect(container.textContent).not.toMatch(/some links on freejoy are affiliate links/i);
    expect(container.textContent).not.toMatch(/may earn/i);
    expect(container.textContent).not.toMatch(/never changes the terms/i);
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

describe('draft status on every legal and editorial page', () => {
  it.each([...LEGAL_PAGES, { name: 'about', Page: AboutPage, metadata: aboutMetadata }])(
    '$name keeps the draft banner and "Not yet reviewed"',
    ({ Page }) => {
      render(<Page />);

      expect(screen.getByText(DRAFT_BANNER)).toBeInTheDocument();
      expect(screen.getByText(/last reviewed: not yet reviewed/i)).toBeInTheDocument();
    }
  );

  it('contact page keeps the draft banner and stays out of search engines', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(DRAFT_BANNER)).toBeInTheDocument();
    expect(contactMetadata.robots).toEqual({ index: false });
  });

  it.each([...LEGAL_PAGES, { name: 'about', Page: AboutPage, metadata: aboutMetadata }])(
    '$name makes no compliance, registration or approval claims',
    ({ Page }) => {
      const { container } = render(<Page />);

      expect(container.textContent).not.toMatch(COMPLIANCE_CLAIMS);
    }
  );

  it('contact page makes no compliance claims and invents no operator details', async () => {
    const { container } = render(await ContactPage({ searchParams: Promise.resolve({}) }));

    expect(container.textContent).not.toMatch(COMPLIANCE_CLAIMS);
    expect(screen.getByText(/have not been added yet/i)).toBeInTheDocument();
  });
});

describe('privacy notice', () => {
  it('describes the alerts data, the double opt-in and the proposed retention, flagged for review', () => {
    const { container } = render(<PrivacyPage />);

    expect(container.textContent).toMatch(/IP address/);
    expect(container.textContent).toMatch(/error-monitoring provider/);
    expect(container.textContent).toMatch(/double opt-in/);
    expect(container.textContent).toMatch(/exact wording you saw/);
    expect(container.textContent).toMatch(/deleted after 30 days/);
    expect(container.textContent).toMatch(/12 months/);
    expect(container.textContent).toMatch(/for legal review/);
    expect(container.textContent).toMatch(/not .* running today/i);
    expect(container.textContent).not.toMatch(/carried to the alerts page/);
    expect(screen.getByRole('heading', { name: 'Email alerts' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/does not save any information|saves nothing/i);
  });

  it('describes account data held when someone creates an account', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { name: 'If you create an account' })).toBeInTheDocument();
    expect(screen.getByText(/IP address and browser of each sign-in/i)).toBeInTheDocument();
  });
});

describe('cookie notice', () => {
  it('names the sign-in cookie and does not promise a banner is never needed', () => {
    const { container } = render(<CookiesPage />);

    expect(screen.getByRole('heading', { name: 'If you sign in' })).toBeInTheDocument();
    expect(container.textContent).toMatch(/called `session`/);
    expect(container.textContent).toMatch(/sign-up page prepares sign-in storage/);
    expect(container.textContent).toMatch(/still to be confirmed in review/i);
  });
});

describe('terms and about copy', () => {
  it('terms say competitions are run by the organiser, not Freejoy', () => {
    render(<TermsPage />);

    expect(screen.getByText(/competitions are run by the organiser/i)).toBeInTheDocument();
  });

  it('about explains that cashback and vouchers are not free and links the disclosure', () => {
    render(<AboutPage />);

    expect(screen.getByRole('heading', { name: 'Not everything is free' })).toBeInTheDocument();
    expect(screen.getByText(/cashback and vouchers are not free/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'affiliate disclosure' })).toHaveAttribute(
      'href',
      '/affiliate-disclosure'
    );
  });
});
