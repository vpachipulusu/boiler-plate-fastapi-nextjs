import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';

/**
 * The emailed-link landing pages. These need no backend and no email outbox: they check that opening a link
 * changes nothing, that the token leaves the address bar, and that the pages fit a 320px phone.
 */

const PAGES = [
  { path: '/alerts/confirm', button: 'Confirm my alerts' },
  { path: '/alerts/unsubscribe', button: /Unsubscribe me/ },
] as const;

for (const { path, button } of PAGES) {
  test.describe(`${path} landing page`, () => {
    test('fits a 320px phone in the incomplete-link state', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await waitForPageReady(page);

      await expect(page.getByText(/link is incomplete/i)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('with a token: shows the button, strips the address and makes no request', async ({
      page,
    }) => {
      const posts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'POST') posts.push(request.url());
      });

      await page.goto(`${path}?token=abc.fake-token`);
      await waitForPageReady(page);

      await expect(page.getByRole('button', { name: button })).toBeVisible();
      await expect.poll(() => new URL(page.url()).search).toBe('');
      expect(await page.content()).not.toContain('abc.fake-token');
      expect(posts).toEqual([]);
    });

    test('is noindex and sends no referrer', async ({ page }) => {
      const response = await page.goto(`${path}?token=abc`);

      expect(response?.headers()['referrer-policy']).toBe('no-referrer');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
  });
}
