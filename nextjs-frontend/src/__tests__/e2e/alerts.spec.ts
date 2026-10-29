import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';

/**
 * Alerts preferences (`/alerts`): layout and client-side validation. The sign-up itself (double opt-in,
 * confirm, unsubscribe) needs a backend with the fake email provider and is in alerts-optin.spec.ts.
 */

const VIEWPORTS = [
  { name: 'desktop 1440', width: 1440, height: 900 },
  { name: 'phone 390', width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`Alerts at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/alerts');
      await waitForPageReady(page);
    });

    test('shows the promise, the six categories and the footer line', async ({ page }) => {
      await expect(
        page.getByRole('heading', { level: 1, name: 'Good things. Straight to you.' })
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Create your free alerts' })).toBeVisible();
      await expect(
        page.getByRole('group', { name: /interested in/i }).getByRole('checkbox')
      ).toHaveCount(6);
      await expect(page.getByLabel('Daily highlights')).toBeChecked();
      await expect(
        page.getByText('No spam · no sold email lists · unsubscribe in one click')
      ).toBeVisible();
    });

    test('has no horizontal overflow', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('shows an error for each missing answer and sends no request', async ({ page }) => {
      const posts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'POST') posts.push(request.url());
      });
      await page.getByLabel('Email address').fill('not-an-email');
      await page.getByRole('button', { name: 'Send me free alerts' }).click();

      await expect(page.getByText('Enter a valid email address.')).toBeVisible();
      await expect(page.getByText('Choose at least one category.')).toBeVisible();
      await expect(page.getByText(/please agree to receive emails/i)).toBeVisible();
      await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
      expect(posts).toEqual([]);
    });
  });
}

test.describe('Alerts address handling and metadata', () => {
  test('never prefills an address from the page address', async ({ page }) => {
    await page.goto('/alerts?email=pre%40example.com');
    await expect(page.getByLabel('Email address')).toHaveValue('');
  });

  test('is noindex with a canonical link until alerts are live in production', async ({ page }) => {
    await page.goto('/alerts');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/alerts$/);
    await expect(page).toHaveTitle(/Free alerts \| Freejoy/);
  });
});
