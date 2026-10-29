import { describe, expect, it, vi, beforeEach } from 'vitest';
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
import OfferPage, * as offerRoute from '@/app/(public)/freebies/[slug]/page';
import AlertsPage from '@/app/(public)/alerts/page';

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
    expect(screen.getByText('Last checked 27 October 2026')).toBeInTheDocument();
    expect(screen.getByText('POSTAGE: FREE')).toBeInTheDocument();
    expect(screen.getByText('UK OFFER')).toBeInTheDocument();
    expect(screen.queryByText('CARD REQUIRED')).toBeNull();
    const steps = screen.getByRole('region', { name: 'How to claim this freebie' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    const related = screen.getByRole('region', { name: 'You might also love' });
    expect(within(related).getAllByRole('article').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /get this free sample/i })).toBeInTheDocument();
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
    expect(screen.getByText('FREE TRIAL')).toBeInTheDocument();
    expect(screen.getByText('Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Trial terms:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start the free trial/i })).toBeInTheDocument();
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
  async function renderAlerts(email?: string | string[]) {
    render(await AlertsPage({ searchParams: Promise.resolve({ email }) }));
  }

  it('shows the promise heading, the form and one checkbox per category', async () => {
    await renderAlerts();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Good things. Straight to you.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create your free alerts' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: /interested in/i });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(6);
  });

  it('prefills a valid email from the query string', async () => {
    await renderAlerts('sam@example.com');

    expect(screen.getByLabelText(/email address/i)).toHaveValue('sam@example.com');
  });

  it('shows a retryable alert instead of the form when the categories cannot be read', async () => {
    catalogueMocks.categories.mockRejectedValue(new CatalogueUnavailableError());

    await renderAlerts();

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load the categories/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /interested in/i })).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Good things. Straight to you.' })
    ).toBeInTheDocument();
  });

  it.each(['not an email', ['a@b.co', 'c@d.co'], undefined])(
    'ignores an unusable email parameter: %j',
    async (value) => {
      await renderAlerts(value as string | string[] | undefined);

      expect(screen.getByLabelText(/email address/i)).toHaveValue('');
    }
  );
});
