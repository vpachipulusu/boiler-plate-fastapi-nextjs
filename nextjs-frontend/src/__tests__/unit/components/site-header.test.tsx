import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteHeader } from '@/components/site/site-header';
import { SITE_TAB_ITEMS, activeTabHref } from '@/components/site/nav-items';

describe('SiteHeader', () => {
  it('renders the wordmark, the main nav, a search form and the alerts call to action', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Freejoy home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'All freebies' })).toHaveAttribute('href', '/freebies');
    expect(screen.getByRole('search')).toHaveAttribute('action', '/freebies');
    expect(screen.getAllByRole('link', { name: 'Get free alerts' })[0]).toHaveAttribute(
      'href',
      '/alerts'
    );
    expect(screen.getAllByRole('link', { name: 'Log in' })[0]).toHaveAttribute('href', '/login');
  });

  it('opens and closes the phone menu sheet', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('toggles the phone search form', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'Search freebies' }));
    expect(screen.getAllByRole('search')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.getAllByRole('search')).toHaveLength(1);
  });
});

describe('activeTabHref', () => {
  it('matches the home tab only on the root path', () => {
    expect(activeTabHref('/')).toBe('/');
    expect(activeTabHref('/freebies/glow-boosting-face-cream-sample')).toBe('/freebies');
    expect(activeTabHref('/alerts')).toBe('/alerts');
    expect(activeTabHref('/about')).toBeNull();
    expect(activeTabHref(null)).toBeNull();
  });

  it('never reports an anchor-only tab as current', () => {
    const anchored = SITE_TAB_ITEMS.filter((item) => item.href.includes('#'));
    expect(anchored.length).toBeGreaterThan(0);
    expect(activeTabHref('/freebies')).toBe('/freebies');
  });
});
