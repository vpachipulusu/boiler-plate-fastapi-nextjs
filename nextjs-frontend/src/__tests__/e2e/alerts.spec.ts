import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';

/**
 * Alerts preferences (`/alerts`) journey. The form validates in the browser and ends in a
 * "not live yet" demo panel: no request is made and nothing is saved.
 */

const VIEWPORTS = [
  { name: 'desktop 1440', width: 1440, height: 900 },
  { name: 'phone 390', width: 390, height: 844 },
] as const;

const DEMO_PANEL = /Alerts aren.t live yet\. Nothing was saved/;

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
        page.getByText('No spam · No sold email lists · Unsubscribe in one click')
      ).toBeVisible();
    });

    test('has no horizontal overflow', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('shows an error for each missing answer and no demo panel', async ({ page }) => {
      await page.getByLabel('Email address').fill('not-an-email');
      await page.getByRole('button', { name: 'Send me free alerts' }).click();

      await expect(page.getByText('Enter a valid email address.')).toBeVisible();
      await expect(page.getByText('Choose at least one category.')).toBeVisible();
      await expect(page.getByText(/please agree to receive emails/i)).toBeVisible();
      await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText(DEMO_PANEL)).toHaveCount(0);
    });

    test('ends in the demo panel and restores the answers on "Change my answers"', async ({
      page,
    }) => {
      const requests: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'POST') requests.push(request.url());
      });

      await page.getByLabel('Email address').fill('sam@example.com');
      await page.getByText('Beauty & skincare', { exact: true }).click();
      await page.getByText('Weekly round-up', { exact: true }).click();
      await page.getByRole('checkbox', { name: /i agree to receive freebie emails/i }).check();
      await page.getByRole('button', { name: 'Send me free alerts' }).click();

      await expect(page.getByText(DEMO_PANEL)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Browse freebies' })).toHaveAttribute(
        'href',
        '/freebies'
      );
      expect(requests).toEqual([]);

      await page.getByRole('button', { name: 'Change my answers' }).click();

      await expect(page.getByLabel('Email address')).toHaveValue('sam@example.com');
      await expect(page.getByLabel('Beauty & skincare')).toBeChecked();
      await expect(page.getByRole('button', { name: 'Send me free alerts' })).toBeVisible();
      await expect(page.getByText(DEMO_PANEL)).toHaveCount(0);
    });
  });
}

test.describe('Alerts query string and metadata', () => {
  test('prefills a valid email and ignores an invalid one', async ({ page }) => {
    await page.goto('/alerts?email=pre%40example.com');
    await expect(page.getByLabel('Email address')).toHaveValue('pre@example.com');

    await page.goto('/alerts?email=not-an-email');
    await expect(page.getByLabel('Email address')).toHaveValue('');
  });

  test('is noindex with a canonical link while the flow is a preview', async ({ page }) => {
    await page.goto('/alerts');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/alerts$/);
    await expect(page).toHaveTitle(/Free alerts \| Freejoy/);
  });
});
