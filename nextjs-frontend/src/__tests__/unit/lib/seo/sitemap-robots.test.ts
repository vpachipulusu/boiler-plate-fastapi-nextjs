import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { CATEGORIES, FIXTURE_TODAY, OFFERS } from '@/lib/catalogue/fixtures';
import type { Category, Offer } from '@/lib/catalogue/types';
import { buildSitemapEntries } from '@/lib/seo/sitemap';
import { DISALLOWED_PATHS } from '@/lib/seo/robots';

const TODAY = '2026-10-29';
const BASE = 'http://localhost:3000';

const template = OFFERS[0] as Offer;
const apiOffer = (slug: string, patch: Partial<Offer> = {}): Offer => ({
  ...template,
  slug,
  source: 'api',
  demo: false,
  status: 'published',
  endAt: null,
  categorySlug: 'beauty',
  lastVerifiedAt: '2026-10-20',
  ...patch,
});

const categories = CATEGORIES.filter((category) => category.enabled);
const disabledCategory: Category = { ...(CATEGORIES[0] as Category), slug: 'off', enabled: false };

const urls = (entries: { url: string }[]) => entries.map((entry) => entry.url);

describe('buildSitemapEntries', () => {
  it('lists only the home page and /freebies while the catalogue is fixture-backed', () => {
    const entries = buildSitemapEntries({ offers: OFFERS, categories, today: FIXTURE_TODAY });

    expect(urls(entries)).toEqual([`${BASE}/`, `${BASE}/freebies`]);
  });

  it('never gives the generic entries a lastModified when nothing has a date', () => {
    const entries = buildSitemapEntries({ offers: OFFERS, categories, today: FIXTURE_TODAY });

    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });

  it('lists published, live API offers and enabled categories once the catalogue is API-backed', () => {
    const offers = [apiOffer('glow-sample'), apiOffer('tea-trial', { categorySlug: 'food-drink' })];

    const entries = buildSitemapEntries({
      offers,
      categories: [...categories, disabledCategory],
      today: TODAY,
    });

    expect(urls(entries)).toEqual([
      `${BASE}/`,
      `${BASE}/freebies`,
      ...categories.map((category) => `${BASE}/category/${category.slug}`),
      `${BASE}/freebies/glow-sample`,
      `${BASE}/freebies/tea-trial`,
    ]);
    expect(urls(entries)).not.toContain(`${BASE}/category/off`);
  });

  it('excludes expired, draft, demo and fixture offers even next to a good API offer', () => {
    const offers = [
      apiOffer('good'),
      apiOffer('expired', { status: 'expired', endAt: '2026-10-20' }),
      apiOffer('ended-but-published', { endAt: '2026-10-28' }),
      apiOffer('draft', { status: 'draft' }),
      apiOffer('demo', { demo: true }),
      { ...apiOffer('fixture'), source: 'fixture' as const },
    ];

    const offerUrls = urls(buildSitemapEntries({ offers, categories, today: TODAY })).filter(
      (url) => url.includes('/freebies/')
    );

    expect(offerUrls).toEqual([`${BASE}/freebies/good`]);
  });

  it('takes lastModified from the offer dates only', () => {
    const offers = [
      apiOffer('verified', { lastVerifiedAt: '2026-10-25' }),
      apiOffer('started', { lastVerifiedAt: '', startAt: '2026-10-01' }),
      apiOffer('undated', { lastVerifiedAt: '', startAt: '' }),
    ];

    const entries = buildSitemapEntries({ offers, categories, today: TODAY });
    const byUrl = new Map(entries.map((entry) => [entry.url, entry.lastModified]));

    expect(byUrl.get(`${BASE}/freebies/verified`)).toBe('2026-10-25');
    expect(byUrl.get(`${BASE}/freebies/started`)).toBe('2026-10-01');
    expect(byUrl.get(`${BASE}/freebies/undated`)).toBeUndefined();
    expect(byUrl.get(`${BASE}/`)).toBe('2026-10-25');
    expect(byUrl.get(`${BASE}/category/beauty`)).toBe('2026-10-25');
  });
});

describe('sitemap route', () => {
  it('serves the home and /freebies entries from the fixture catalogue', async () => {
    expect(urls(await sitemap())).toEqual([`${BASE}/`, `${BASE}/freebies`]);
  });
});

describe('robots route', () => {
  it('allows public routes and disallows the private prefixes', () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.userAgent).toBe('*');
    expect(rule?.allow).toBe('/');
    expect(rule?.disallow).toEqual(
      expect.arrayContaining(['/admin', '/dashboard', '/go/', '/api/', '/login', '/signup'])
    );
    expect(DISALLOWED_PATHS).toHaveLength(6);
  });

  it('references the absolute sitemap url', () => {
    expect(robots().sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});
