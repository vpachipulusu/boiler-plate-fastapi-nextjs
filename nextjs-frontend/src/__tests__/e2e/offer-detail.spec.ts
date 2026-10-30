import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';
import { formatIsoDate } from '../../components/offer/offer-format';
import { OFFERS } from '../../lib/catalogue/fixtures';

/**
 * Offer detail (`/freebies/[slug]`) journey on the FIXTURE catalogue (the e2e server runs with
 * CATALOGUE_SOURCE=fixture unless E2E_LIVE_CATALOGUE=1; see catalogue-live.spec.ts for real data).
 * Fixture offers have no destination, so the call to action opens a "Demo offer" dialog and the page
 * never links to an external site.
 */

test.skip(
  process.env.E2E_LIVE_CATALOGUE === '1',
  'Fixture specs: the server is on the live catalogue'
);

const SAMPLE_SLUG = 'glow-boosting-face-cream-sample';
const SAMPLE = `/freebies/${SAMPLE_SLUG}`;
const SAMPLE_DATE = OFFERS.find((offer) => offer.slug === SAMPLE_SLUG)?.lastVerifiedAt;
const TRIAL = '/freebies/overnight-sheet-mask-trial';
const EXPIRED = '/freebies/laundry-sheets-sample';

const VIEWPORTS = [
  { name: 'desktop 1440', width: 1440, height: 900 },
  { name: 'phone 390', width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`Offer detail at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('shows the offer, the trust panel and the claim steps', async ({ page }) => {
      await page.goto(SAMPLE);
      await waitForPageReady(page);

      await expect(
        page.getByRole('heading', { level: 1, name: 'Glow-boosting face cream sample' })
      ).toBeVisible();
      if (!SAMPLE_DATE) throw new Error('Fixture sample offer not found');
      await expect(page.getByText(`Sample date ${formatIsoDate(SAMPLE_DATE)}`)).toBeVisible();
      await expect(page.getByText('POSTAGE: FREE', { exact: true })).toBeVisible();
      await expect(page.getByText('UK OFFER')).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'How to claim this freebie' }).getByRole('listitem')
      ).toHaveCount(3);
      await expect(page.getByRole('region', { name: 'You might also love' })).toBeVisible();
    });

    test('has no horizontal overflow', async ({ page }) => {
      await page.goto(SAMPLE);
      await waitForPageReady(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('opens the demo dialog, closes it with Escape and never leaves the site', async ({
      page,
    }) => {
      await page.goto(SAMPLE);
      await waitForPageReady(page);
      const cta = page.getByRole('button', { name: 'Request this sample' });

      await cta.click();
      await expect(page.getByRole('dialog', { name: 'Demo offer' })).toBeVisible();
      await page.keyboard.press('Escape');

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(cta).toBeFocused();
      expect(new URL(page.url()).pathname).toBe(SAMPLE);
      await expect(page.locator('main a[href^="http"]')).toHaveCount(0);
    });

    test('shows the card requirement and cancellation terms for a free trial', async ({ page }) => {
      await page.goto(TRIAL);
      await waitForPageReady(page);

      await expect(page.getByText('CARD REQUIRED')).toBeVisible();
      await expect(page.getByText('Cancellation', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start the trial' })).toBeVisible();
    });

    test('replaces the call to action when the offer has ended', async ({ page }) => {
      await page.goto(EXPIRED);
      await waitForPageReady(page);

      await expect(page.getByRole('heading', { name: 'This offer has ended' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /get this|start the|enter this/i })
      ).toHaveCount(0);
      await page.getByRole('main').getByRole('link', { name: 'Browse all freebies' }).click();
      await expect(page).toHaveURL(/\/freebies$/);
    });
  });
}

test.describe('Offer detail routing and metadata', () => {
  // No loading.tsx sits above the public pages, so notFound() runs before the response starts and the
  // status really is 404 (src/__tests__/unit/config/loading-boundary.test.ts guards this).
  for (const [name, route] of [
    ['an unknown offer slug', '/freebies/no-such-offer'],
    ['a draft offer', '/freebies/cat-pouch-tasting-sample'],
    ['a slug that is not a slug', '/freebies/Bad%20Slug'],
    ['an unknown category', '/category/no-such-category'],
  ] as const) {
    test(`returns 404 and the not-found page for ${name}`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    });
  }

  test('is noindex with a canonical link while fixture-backed', async ({ page }) => {
    await page.goto(SAMPLE);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/freebies\/glow-boosting-face-cream-sample$/
    );
    await expect(page).toHaveTitle(/Glow-boosting face cream sample \| Freejoy/);
  });

  test('links the breadcrumb back to the category and home', async ({ page }) => {
    await page.goto(SAMPLE);
    await waitForPageReady(page);

    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(trail.getByRole('link', { name: /beauty/i })).toHaveAttribute(
      'href',
      '/category/beauty'
    );
  });
});
