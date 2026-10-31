import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const catalogueMocks = vi.hoisted(() => ({ categories: vi.fn() }));
vi.mock('@/lib/catalogue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalogue')>();
  return {
    ...actual,
    getCategories: () =>
      catalogueMocks.categories.getMockImplementation()
        ? catalogueMocks.categories()
        : actual.getCategories(),
  };
});

import { CatalogueUnavailableError } from '@/lib/catalogue/errors';
import { OFFERS } from '@/lib/catalogue/fixtures';
import { formatIsoDate } from '@/components/offer/offer-format';
import OfferPage, * as offerRoute from '@/app/(public)/freebies/[slug]/page';
import AlertsPage, { generateMetadata as alertsMetadata } from '@/app/(public)/alerts/page';

const generateMetadata = offerRoute.generateMetadata;

const SAMPLE = 'glow-boosting-face-cream-sample';
const TRIAL = 'overnight-sheet-mask-trial';
const EXPIRED = 'laundry-sheets-sample';
const DRAFT = 'cat-pouch-tasting-sample';

async function renderOffer(slug: string) {
  return render(await OfferPage({ params: Promise.resolve({ slug }) }));
}

function externalHrefs(): string[] {
  return Array.from(document.querySelectorAll('[href]'))
    .map((el) => el.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('http'));
}

beforeEach(() => {
  notFoundMock.mockClear();
  catalogueMocks.categories.mockReset();
});

describe('offer detail page', () => {
  it('renders the title, trust panel date, three claim steps and the related grid', async () => {
    await renderOffer(SAMPLE);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Glow-boosting face cream sample' })
    ).toBeInTheDocument();
    const sampleOffer = OFFERS.find((offer) => offer.slug === SAMPLE)!;
    expect(
      screen.getByText(`Sample date ${formatIsoDate(sampleOffer.lastVerifiedAt)}`)
    ).toBeInTheDocument();
    expect(screen.getByText('POSTAGE: FREE')).toBeInTheDocument();
    expect(screen.getByText('UK OFFER')).toBeInTheDocument();
    expect(screen.queryByText('CARD REQUIRED')).toBeNull();
    const steps = screen.getByRole('region', { name: 'How to claim this freebie' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    const related = screen.getByRole('region', { name: 'You might also love' });
    expect(within(related).getAllByRole('article').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /request this sample/i })).toBeInTheDocument();
  });

  it('links the breadcrumb trail to home and the category', async () => {
    await renderOffer(SAMPLE);

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(trail).getByRole('link', { name: /beauty/i })).toHaveAttribute(
      'href',
      '/category/beauty'
    );
  });

  it('shows the ended panel and no call to action for an expired offer', async () => {
    await renderOffer(EXPIRED);

    expect(screen.getByRole('heading', { name: 'This offer has ended' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get this|start the|enter this/i })).toBeNull();
    expect(screen.getByRole('link', { name: /browse all freebies/i })).toHaveAttribute(
      'href',
      '/freebies'
    );
  });

  it('calls notFound for a draft offer', async () => {
    await expect(renderOffer(DRAFT)).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('calls notFound for an unknown slug', async () => {
    await expect(renderOffer('no-such-offer')).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('flags the card requirement and quotes the cancellation terms for a free trial', async () => {
    await renderOffer(TRIAL);

    expect(screen.getByText('CARD REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('TRIAL')).toBeInTheDocument();
    expect(screen.getByText('Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Trial terms:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start the trial/i })).toBeInTheDocument();
  });

  it.each([SAMPLE, TRIAL, EXPIRED])('has no external href on %s', async (slug) => {
    await renderOffer(slug);

    expect(externalHrefs()).toEqual([]);
  });

  it('builds noindex metadata with a canonical link from the offer', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: SAMPLE }) });

    expect(metadata.title).toBe('Glow-boosting face cream sample');
    expect(metadata.alternates?.canonical).toBe(`/freebies/${SAMPLE}`);
    expect(metadata.robots).toEqual({ index: false });
    expect(metadata.openGraph).toMatchObject({ type: 'article' });
  });

  it('renders per request, so the build never needs the catalogue', () => {
    expect(offerRoute.dynamic).toBe('force-dynamic');
    expect('generateStaticParams' in offerRoute).toBe(false);
  });
});

describe('alerts page', () => {
  const HEADING = { level: 1, name: 'Good things. Straight to you.' } as const;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function renderAlerts(flag: 'true' | '') {
    vi.stubEnv('ALERTS_FORM_LIVE', flag);
    render(await AlertsPage());
  }

  it('closed: shows the promise heading and a plain notice, with no form', async () => {
    await renderAlerts('');

    expect(screen.getByRole('heading', HEADING)).toBeInTheDocument();
    expect(screen.getByText(/alerts aren.t open yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /interested in/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /send me free alerts/i })).toBeNull();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
  });

  it('open: shows the form with the categories', async () => {
    await renderAlerts('true');

    expect(screen.getByRole('group', { name: /interested in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send me free alerts/i })).toBeInTheDocument();
    expect(screen.queryByText(/alerts aren.t open yet/i)).toBeNull();
  });

  it('is indexable only while open', async () => {
    vi.stubEnv('ALERTS_FORM_LIVE', 'true');
    expect((await alertsMetadata()).robots).not.toEqual({ index: false });
    vi.stubEnv('ALERTS_FORM_LIVE', '');
    expect((await alertsMetadata()).robots).toEqual({ index: false });
  });

  it('closed: still says alerts are not open when the categories cannot be read, and does not ask for them', async () => {
    catalogueMocks.categories.mockRejectedValue(new CatalogueUnavailableError());

    await renderAlerts('');

    expect(screen.getByText(/alerts aren.t open yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/the alerts form is not loading/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(catalogueMocks.categories).not.toHaveBeenCalled();
  });

  it('open: shows a retryable alert instead of the form when the categories cannot be read', async () => {
    catalogueMocks.categories.mockRejectedValue(new CatalogueUnavailableError());

    await renderAlerts('true');

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load the categories/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /interested in/i })).toBeNull();
    expect(screen.getByRole('heading', HEADING)).toBeInTheDocument();
  });
});
