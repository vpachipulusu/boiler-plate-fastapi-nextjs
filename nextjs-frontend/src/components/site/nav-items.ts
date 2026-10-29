import { Bell, Home, LayoutGrid, Search, type LucideIcon } from 'lucide-react';

export interface SiteNavItem {
  href: string;
  label: string;
}

export interface SiteTabItem extends SiteNavItem {
  icon: LucideIcon;
}

/** Header navigation (design screens 01-04). Only routes that exist have an entry. */
export const SITE_NAV_ITEMS: ReadonlyArray<SiteNavItem> = [
  { href: '/freebies', label: 'All freebies' },
  { href: '/freebies#categories', label: 'Categories' },
  { href: '/freebies?sort=newest', label: 'Just added' },
  { href: '/about#how-it-works', label: 'How it works' },
];

/**
 * Phone tab bar (design screens 05/06). The design's "Saved" tab is deferred (FREEJ-28), so no
 * dead-end control ships: Categories takes its slot.
 */
export const SITE_TAB_ITEMS: ReadonlyArray<SiteTabItem> = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/freebies', label: 'Browse', icon: Search },
  { href: '/freebies#categories', label: 'Categories', icon: LayoutGrid },
  { href: '/alerts', label: 'Alerts', icon: Bell },
];

export const FOOTER_LINKS: ReadonlyArray<SiteNavItem> = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/terms', label: 'Terms' },
  { href: '/affiliate-disclosure', label: 'Affiliate disclosure' },
];

/** The tab whose path equals the current path or is a parent segment of it ("/" matches only itself). */
export function activeTabHref(pathname: string | null): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const { href } of SITE_TAB_ITEMS) {
    if (href.includes('#')) continue;
    const matches = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
