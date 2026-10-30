import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';
import type { Page } from '@playwright/test';

/**
 * Catalogue (/freebies) journey, on desktop and at 390px: search, filter by offer type, open a
 * result, come Back with the filters intact, and reach the empty state with a working way out.
 * The catalogue is fixture-backed (the e2e server runs with CATALOGUE_SOURCE=fixture unless
 * E2E_LIVE_CATALOGUE=1), so no seeded data is needed beyond the running app.
 */

test.skip(
  process.env.E2E_LIVE_CATALOGUE === '1',
  'Fixture specs: the server is on the live catalogue'
);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile 390px', width: 390, height: 844 },
] as const;

async function search(page: Page, text: string) {
  const box = page.locator('#catalogue-search');
  await box.fill(text);
  await box.press('Enter');
  await page.waitForURL(new RegExp(`[?&]q=${encodeURIComponent(text)}`));
  await waitForPageReady(page);
}

/** Desktop: the sidebar link. Phones and tablets: the same link inside the Filter sheet. */
async function chooseOfferType(page: Page, label: string, isDesktop: boolean) {
  if (isDesktop) {
    await page.getByRole('complementary').getByRole('link', { name: label, exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Filter/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filter freebies' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: label, exact: true }).click();
    await expect(sheet).toBeHidden();
  }
  await page.waitForURL(/[?&]type=free_sample/);
  await waitForPageReady(page);
}

for (const viewport of VIEWPORTS) {
  const isDesktop = viewport.width >= 1024;

  test.describe(`Catalogue on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/freebies');
      await waitForPageReady(page);
    });

    test('shows the heading, the search and a grid of offers', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText('little treat.');
      await expect(page.locator('#catalogue-search')).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'All freebies' })).toBeVisible();
      await expect(page.getByText(/\d+ freebies in this collection/)).toBeVisible();
      expect(await page.locator('main article').count()).toBeGreaterThan(0);
    });

    test('keeps the search and offer type in the URL after opening a result and going Back', async ({
      page,
    }) => {
      await search(page, 'pet');
      await chooseOfferType(page, 'Free sample', isDesktop);

      await expect(page).toHaveURL(/q=pet/);
      await expect(page).toHaveURL(/type=free_sample/);
      const firstResult = page.locator('main article a').first();
      await expect(firstResult).toBeVisible();
      await firstResult.click();
      await expect(page).toHaveURL(/\/freebies\/[^/?#]+$/);

      await page.goBack();
      await waitForPageReady(page);

      await expect(page).toHaveURL(/q=pet/);
      await expect(page).toHaveURL(/type=free_sample/);
      await expect(page.locator('#catalogue-search')).toHaveValue('pet');
      await expect(page.locator('main article').first()).toBeVisible();
    });

    test('shows the empty state for a search with no matches and Clear filters returns to /freebies', async ({
      page,
    }) => {
      await search(page, 'zzzz');

      await expect(page.getByRole('heading', { name: 'No freebies match that yet' })).toBeVisible();
      await expect(page.locator('main article')).toHaveCount(0);

      await page.getByRole('link', { name: 'Clear filters' }).click();

      await expect(page).toHaveURL(/\/freebies$/);
      await expect(page.locator('main article').first()).toBeVisible();
      await expect(page.locator('#catalogue-search')).toHaveValue('');
    });

    test('changes the sort from the URL-backed control and keeps the search', async ({ page }) => {
      await search(page, 'pet');
      if (isDesktop) {
        await page.getByLabel('Sort by').selectOption('a_z');
        // The select never submits on change (WCAG 3.2.2); Apply does.
        await page.getByRole('button', { name: 'Apply' }).click();
      } else {
        await page.getByRole('button', { name: /^Filter/ }).click();
        await page
          .getByRole('dialog', { name: 'Filter freebies' })
          .getByRole('link', { name: 'A to Z', exact: true })
          .click();
      }

      await expect(page).toHaveURL(/sort=a_z/);
      await expect(page).toHaveURL(/q=pet/);
    });

    test('has no horizontal scroll', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );

      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
