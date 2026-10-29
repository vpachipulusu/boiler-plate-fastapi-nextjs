import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ notFound: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

import CategoryPage, {
  generateMetadata as categoryMetadata,
  generateStaticParams,
} from '@/app/(public)/category/[slug]/page';
import FreebiesPage, { generateMetadata as freebiesMetadata } from '@/app/(public)/freebies/page';
import { CatalogueHeading, CatalogueResults } from '@/components/catalogue/catalogue-results';
import { FilterSidebar } from '@/components/catalogue/filter-sidebar';
import {
  CATALOGUE_PAGE_SIZE,
  DEFAULT_QUERY,
  getCategories,
  getOfferBySlug,
  parseCatalogueParams,
  searchOffers,
  type CatalogueQuery,
} from '@/lib/catalogue';
import { FIXTURE_TODAY } from '@/lib/catalogue/fixtures';

const noParams = Promise.resolve({});

function cardSlugs(): string[] {
  return screen
    .getAllByRole('link', { name: /.+/ })
    .map((link) => link.getAttribute('href') ?? '')
    .filter((href) => /^\/freebies\/[^/?#]+$/.test(href))
    .map((href) => href.replace('/freebies/', ''));
}

function elementsOf(node: ReactNode): ReactElement[] {
  const children = (node as ReactElement<{ children?: ReactNode }>).props.children;
  return (Array.isArray(children) ? children : [children]).filter(isValidElement);
}

beforeEach(() => mocks.notFound.mockClear());

describe('catalogue results', () => {
  it('lists one page of live offers with the real total for the default query', async () => {
    const expected = await searchOffers(DEFAULT_QUERY);

    render(
      <>
        {await CatalogueHeading({ query: DEFAULT_QUERY })}
        {await CatalogueResults({ query: DEFAULT_QUERY })}
      </>
    );

    expect(screen.getByRole('heading', { level: 2, name: 'All freebies' })).toBeInTheDocument();
    expect(screen.getByText(`${expected.total} freebies in this collection`)).toBeInTheDocument();
    expect(cardSlugs()).toHaveLength(Math.min(expected.total, CATALOGUE_PAGE_SIZE));
    expect(screen.getByText(/availability can change quickly/i)).toBeInTheDocument();
  });

  it('never shows an expired or draft offer', async () => {
    const everything = parseCatalogueParams({ sort: 'a_z' });

    for (const page of [1, 2]) {
      render(await CatalogueResults({ query: { ...everything, page } }));
      for (const slug of cardSlugs()) {
        const offer = await getOfferBySlug(slug);
        expect(offer?.status).toBe('published');
        expect(offer?.endAt === null || (offer?.endAt ?? '') >= FIXTURE_TODAY).toBe(true);
      }
      document.body.innerHTML = '';
    }
  });

  it('shows the empty state with a Clear filters link back to /freebies when nothing matches', async () => {
    const query = parseCatalogueParams({ q: 'zzzz' });

    render(await CatalogueResults({ query }));

    expect(screen.getByRole('heading', { name: 'No freebies match that yet' })).toBeInTheDocument();
    expect(screen.getByText(/“zzzz”/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/freebies'
    );
    expect(screen.getByRole('link', { name: 'Pets' })).toHaveAttribute(
      'href',
      '/freebies?category=pets'
    );
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });

  it('shows a zero count in the heading row when nothing matches', async () => {
    const query = parseCatalogueParams({ q: 'zzzz' });

    render(await CatalogueHeading({ query }));

    expect(screen.getByText('0 freebies in this collection')).toBeInTheDocument();
  });
});

describe('freebies page', () => {
  it('titles the page "All freebies" and keeps the fixture listing out of search', async () => {
    const metadata = await freebiesMetadata({ searchParams: noParams });

    expect(metadata.title).toBe('All freebies');
    expect(metadata.alternates?.canonical).toBe('/freebies');
    expect(metadata.robots).toEqual({ index: false });
  });

  it('titles a search "Search: <q>" and asks search engines not to index it', async () => {
    const metadata = await freebiesMetadata({ searchParams: Promise.resolve({ q: 'pet' }) });

    expect(metadata.title).toBe('Search: pet');
    expect(metadata.alternates?.canonical).toBe('/freebies');
    expect(metadata.robots).toEqual({ index: false });
  });

  it('does not index page 2', async () => {
    const metadata = await freebiesMetadata({ searchParams: Promise.resolve({ page: '2' }) });

    expect(metadata.robots).toEqual({ index: false });
  });

  it('renders the header with the search prefilled from the URL', async () => {
    const element = await FreebiesPage({ searchParams: Promise.resolve({ q: 'tea' }) });
    const [header] = elementsOf(element);

    render(header);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Find your next\s*little free thing\./
    );
    expect(screen.getByRole('searchbox', { name: 'Search freebies' })).toHaveValue('tea');
  });
});

describe('category page', () => {
  it('lists only offers from that category', async () => {
    const element = await CategoryPage({
      params: Promise.resolve({ slug: 'pets' }),
      searchParams: noParams,
    });
    const [intro, layout] = elementsOf(element);
    const scoped = layout.props as { query: CatalogueQuery; scopeCategory: string };

    render(intro);
    render(await CatalogueResults(scoped));

    expect(screen.getByRole('heading', { level: 1, name: 'Pets freebies' })).toBeInTheDocument();
    const slugs = cardSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect((await getOfferBySlug(slug))?.categorySlug).toBe('pets');
    }
  });

  it('calls notFound for an unknown category slug', async () => {
    mocks.notFound.mockImplementationOnce(() => {
      throw new Error('NEXT_NOT_FOUND');
    });

    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: 'no-such-category' }),
        searchParams: noParams,
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it('builds a static page for every enabled category', async () => {
    const categories = await getCategories();

    expect(await generateStaticParams()).toEqual(categories.map(({ slug }) => ({ slug })));
  });

  it('sets the category title, canonical and OpenGraph, and stays out of search for now', async () => {
    const metadata = await categoryMetadata({ params: Promise.resolve({ slug: 'pets' }) });

    expect(metadata.title).toBe('Pets freebies in the UK');
    expect(metadata.alternates?.canonical).toBe('/category/pets');
    expect(metadata.openGraph?.title).toBe('Pets freebies in the UK');
    expect(metadata.robots).toEqual({ index: false });
  });
});

describe('filter sidebar', () => {
  const query = parseCatalogueParams({
    q: 'pet',
    type: 'free_sample',
    postage: 'free',
    sort: 'a_z',
    page: '3',
  });

  async function renderSidebar(scopeCategory?: string) {
    const categories = await getCategories();
    render(<FilterSidebar query={query} categories={categories} scopeCategory={scopeCategory} />);
  }

  it('keeps the search, type, postage and sort when a category is chosen, and returns to page 1', async () => {
    await renderSidebar();

    expect(screen.getByRole('link', { name: 'Beauty' })).toHaveAttribute(
      'href',
      '/freebies?q=pet&category=beauty&type=free_sample&postage=free&sort=a_z'
    );
  });

  it('adds a second offer type to the selection and removes a selected one', async () => {
    await renderSidebar();

    expect(screen.getByRole('link', { name: 'Free trial' })).toHaveAttribute(
      'href',
      '/freebies?q=pet&type=free_sample%2Cfree_trial&postage=free&sort=a_z'
    );
    expect(screen.getByRole('link', { name: 'Free sample' })).toHaveAttribute(
      'href',
      '/freebies?q=pet&postage=free&sort=a_z'
    );
  });

  it('turns the postage filter off from its own link and marks it as current', async () => {
    await renderSidebar();

    const postage = screen.getByRole('link', { name: 'No postage required' });
    expect(postage).toHaveAttribute('aria-current', 'true');
    expect(postage).toHaveAttribute('href', '/freebies?q=pet&type=free_sample&sort=a_z');
  });

  it('marks All freebies as the current category when none is chosen', async () => {
    await renderSidebar();

    expect(screen.getByRole('link', { name: 'All freebies' })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  it('hides the category list on a category page and keeps links inside that category', async () => {
    await renderSidebar('pets');

    const sidebar = screen.getByRole('complementary');
    expect(within(sidebar).queryByRole('link', { name: 'Beauty' })).toBeNull();
    expect(within(sidebar).getByRole('link', { name: 'Switch category' })).toHaveAttribute(
      'href',
      '/freebies?category=pets#categories'
    );
    expect(within(sidebar).getByRole('link', { name: 'Free trial' })).toHaveAttribute(
      'href',
      '/category/pets?q=pet&type=free_sample%2Cfree_trial&postage=free&sort=a_z'
    );
  });
});
