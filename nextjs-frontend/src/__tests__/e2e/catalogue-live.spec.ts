import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';

/**
 * Catalogue on REAL data (FREEJ-21): the homepage, catalogue, category and offer pages read published
 * offers from the catalogue API through the Next.js server. Nothing here is fixture data.
 *
 * NOT RUN IN FREEJ-21. These specs need a backend seeded with published offers (the dev seed command,
 * FREEJ-20) and an e2e server on the live catalogue. How to run:
 *
 *   1. Start a backend on a free port against a TEST database and seed it (see docs/developer/local-e2e.md
 *      and docs/developer/backend-catalogue.md).
 *   2. export E2E_LIVE_CATALOGUE=1 BACKEND_API_URL=http://127.0.0.1:<port> BACKEND_INTERNAL_KEY=<same key>
 *      Optional, for journey 5: E2E_ENDED_OFFER_SLUG=<slug of a seeded offer that was published and has ended>
 *   3. npm run test:e2e:local -- src/__tests__/e2e/catalogue-live.spec.ts
 *
 * E2E_LIVE_CATALOGUE=1 makes scripts/e2e-env.cjs start the e2e server with CATALOGUE_SOURCE=api. Without
 * it the server serves fixtures, this file is skipped and the fixture specs run instead.
 *
 * Journey 1: a visitor browses real published offers: home, catalogue, an offer, back to its category.
 * Journey 5: an unknown offer is a not-found page, an ended offer says it has ended, and the public
 *            pages set no cookies.
 */

test.skip(
  process.env.E2E_LIVE_CATALOGUE !== '1',
  'Needs a seeded backend and E2E_LIVE_CATALOGUE=1 (see the header of this file)'
);

const WIDTHS = [320, 390, 1440] as const;
const ENDED_SLUG = process.env.E2E_ENDED_OFFER_SLUG;

test.describe('Journey 1: browsing real published offers', () => {
  test('shows real offers on the homepage, with no demo wording', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    const freshlyFound = page.getByRole('region', { name: /freshly found/i });
    await expect(freshlyFound.getByRole('article').first()).toBeVisible();
    await expect(page.getByText(/design preview|sample listings/i)).toHaveCount(0);
    await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /index/);
    await expect(page.locator('meta[name="robots"]').first()).not.toHaveAttribute(
      'content',
      /noindex/
    );
  });

  test('lists the catalogue, filters it by URL and opens an offer', async ({ page }) => {
    await page.goto('/freebies');
    await waitForPageReady(page);

    await expect(page.getByText(/\d+ freebies? in this collection/)).toBeVisible();
    const firstCard = page.getByRole('article').first();
    const title = (await firstCard.getByRole('heading', { level: 3 }).innerText()).trim();
    await firstCard.getByRole('link', { name: title }).click();

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/^Last checked /)).toBeVisible();
    await expect(page).toHaveTitle(
      new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| Freejoy`)
    );
    await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
    await expect(page.locator('main a[href^="http"]')).toHaveCount(0);
  });

  test('walks from an offer back to its category page', async ({ page }) => {
    await page.goto('/freebies');
    await waitForPageReady(page);
    await page.getByRole('article').first().getByRole('link').first().click();

    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await trail.getByRole('link').nth(1).click();

    await expect(page).toHaveURL(/\/category\/[a-z0-9-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: /freebies$/ })).toBeVisible();
  });

  test('searches without JavaScript state: the term lives in the URL and the page keeps working', async ({
    page,
  }) => {
    await page.goto('/freebies?q=zzzz-no-such-offer');
    await waitForPageReady(page);

    await expect(page.getByRole('heading', { name: 'No freebies match that yet' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  });

  for (const width of WIDTHS) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/freebies']) {
        await page.goto(path);
        await waitForPageReady(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('Journey 5: missing and ended offers, and privacy', () => {
  test('returns 404 and the not-found page, noindex, for an unknown offer', async ({ page }) => {
    const response = await page.goto('/freebies/no-such-offer-anywhere');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });

  test('shows the ended state, noindex follow, for an offer that has ended', async ({ page }) => {
    test.skip(
      !ENDED_SLUG,
      'Set E2E_ENDED_OFFER_SLUG to a seeded offer that was published and ended'
    );
    await page.goto(`/freebies/${ENDED_SLUG}`);
    await waitForPageReady(page);

    await expect(page.getByRole('heading', { name: 'This offer has ended' })).toBeVisible();
    await expect(page.getByRole('button', { name: /get this|start the|enter this/i })).toHaveCount(
      0
    );
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      /noindex, follow/
    );
    await page.getByRole('main').getByRole('link', { name: 'More in this category' }).click();
    await expect(page).toHaveURL(/\/category\/[a-z0-9-]+$/);
  });

  test('sets no cookies on the public pages', async ({ page, context }) => {
    for (const path of ['/', '/freebies', '/freebies/no-such-offer-anywhere']) {
      await page.goto(path);
      await waitForPageReady(page);
    }

    expect(await context.cookies()).toEqual([]);
  });

  test('never calls the backend from the browser', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));

    await page.goto('/');
    await waitForPageReady(page);
    await page.goto('/freebies');
    await waitForPageReady(page);

    const backendCalls = requested.filter((url) => /\/v1\/catalogue|:8\d{3}\//.test(url));
    expect(backendCalls).toEqual([]);
    const html = await page.content();
    expect(html).not.toMatch(/BACKEND_INTERNAL_KEY|BACKEND_API_URL|X-Internal-Key/);
  });

  test('keeps the retry button reachable by keyboard when the catalogue is in its error state', async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_CATALOGUE_DOWN !== '1',
      'Set E2E_CATALOGUE_DOWN=1 with the backend stopped to exercise the error state'
    );
    await page.goto('/freebies?sort=a_z');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/psycopg|traceback|internal/i);
    const retry = alert.getByRole('button', { name: 'Try again' });
    for (let presses = 0; presses < 25; presses += 1) {
      if (await retry.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(retry).toBeFocused();
    const box = await retry.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
