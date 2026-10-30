import { readFileSync } from 'node:fs';
import { test, expect } from './helpers/fixtures';
import {
  STORAGE_STATE,
  expectToast,
  setSessionCookie,
  waitForPageReady,
} from './helpers/e2e-utils';

/**
 * Journey 4 (FREEJ-22): an admin drafts a freebie, verifies it, publishes it, sees it on the public site,
 * unpublishes it and sees it disappear. Plus the admin area's layout at 320, 390 and 1440 px and the
 * non-admin redirect.
 *
 * Needs a real, seeded backend (the same one catalogue-live.spec.ts uses) and the app serving the catalogue API:
 *
 *   export E2E_LIVE_CATALOGUE=1 BACKEND_API_URL=http://127.0.0.1:<port> BACKEND_INTERNAL_KEY=<same key>
 *
 * and an admin session, in one of two ways:
 *   - the normal way: TEST_ADMIN_EMAIL (+ `npm run test:setup`), which saves the admin session that
 *     auth.setup.ts logs in with against the Firebase TEST project; or
 *   - without Firebase: E2E_ADMIN_SESSION_COOKIE (and optionally E2E_PLAIN_SESSION_COOKIE for a signed-in
 *     non-admin), the session values a backend started with fastapi_backend/tests/e2e_identity_server.py accepts.
 *     See docs/developer/admin-offers.md ("Journey 4").
 *
 * Without the flag, or without an admin session, the whole file skips.
 */

const FAKE_ADMIN_COOKIE = process.env.E2E_ADMIN_SESSION_COOKIE;
const FAKE_PLAIN_COOKIE = process.env.E2E_PLAIN_SESSION_COOKIE;
const HAS_ADMIN_SESSION = Boolean(FAKE_ADMIN_COOKIE) || Boolean(process.env.TEST_ADMIN_EMAIL);

test.skip(
  process.env.E2E_LIVE_CATALOGUE !== '1' || !HAS_ADMIN_SESSION,
  'Needs E2E_LIVE_CATALOGUE=1, a seeded backend and an admin session (see the header of this file)'
);

const WIDTHS = [320, 390, 1440] as const;
const ADMIN_PAGES = [
  '/admin/offers',
  '/admin/offers/new',
  '/admin/categories',
  '/admin/categories/new',
  '/admin/merchants',
  '/admin/merchants/new',
] as const;

async function signInAsAdmin(context: Parameters<typeof setSessionCookie>[0]): Promise<void> {
  if (FAKE_ADMIN_COOKIE) {
    await setSessionCookie(context, FAKE_ADMIN_COOKIE);
    return;
  }
  const state = JSON.parse(readFileSync(STORAGE_STATE.admin, 'utf8')) as {
    cookies: Parameters<typeof context.addCookies>[0];
  };
  await context.addCookies(state.cookies);
}

test.describe('Journey 4: draft, verify, publish, see it live, unpublish', () => {
  test.describe.configure({ mode: 'serial' });

  const title = `Journey Four Sample ${Date.now()}`;
  let offerPath = '';
  let slug = '';

  test.beforeEach(async ({ context }) => {
    await signInAsAdmin(context);
  });

  test('creates a draft that is not public', async ({ page }) => {
    await page.goto('/admin/offers/new');
    await waitForPageReady(page);

    await page.getByLabel(/^Title/).fill(title);
    await page.getByLabel(/^Summary/).fill('A sample created by the admin journey test.');
    await page.getByLabel(/^Category/).selectOption({ index: 1 });
    await page.getByLabel(/^Merchant/).selectOption({ index: 1 });
    await page.getByLabel(/^Picture label/).fill('journey');
    await page.getByLabel(/^Picture description/).fill('A plain test illustration');
    await page.getByLabel(/^Who can claim/).fill('Anyone in the UK.');
    await page.getByLabel(/^Availability/).fill('For the length of the test.');
    await page.getByLabel(/^Source URL/).fill('https://example.com/journey-four');
    await page.getByRole('button', { name: 'Add a step' }).click();
    await page.getByLabel(/^Step title/).fill('Open the page');
    await page.getByLabel(/^Step detail/).fill('Follow the link.');

    // The preview card follows the form and says nothing is public yet.
    const preview = page.getByRole('complementary', { name: 'Card preview' });
    await expect(preview.getByText(title)).toBeVisible();
    await expect(preview.getByText(/Not saved yet/)).toBeVisible();

    await page.getByRole('button', { name: 'Create draft' }).click();
    await page.waitForURL(/\/admin\/offers\/(?!new$)[\w-]+$/);
    offerPath = new URL(page.url()).pathname;

    await waitForPageReady(page);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1 }).locator('..').getByText('Draft')
    ).toBeVisible();
    slug = await page.getByLabel(/^Slug/).inputValue();
    expect(slug).toMatch(/^journey-four-sample-\d+$/);
    // A draft has no public page, only the in-admin preview card.
    await expect(page.getByRole('link', { name: /View the live page/ })).toHaveCount(0);

    const publicResponse = await page.request.get(`/freebies/${slug}`);
    expect(publicResponse.status()).toBe(404);
  });

  test('refuses to publish an unverified offer, says why, then verifies it', async ({ page }) => {
    await page.goto(offerPath);
    await waitForPageReady(page);
    await expect(page.getByText('Not verified yet')).toBeVisible();

    await page.getByRole('button', { name: 'Publish' }).click();
    await expectToast(page, /cannot be published yet: it has not been verified/);

    await page.getByRole('button', { name: 'Mark verified' }).click();
    await expectToast(page, 'Offer marked as verified');
    await expect(page.getByText(/Last verified \d{1,2} \w{3} \d{4}/)).toBeVisible();
  });

  test('publishes it and the public page shows it', async ({ page }) => {
    await page.goto(offerPath);
    await waitForPageReady(page);

    await page.getByRole('button', { name: 'Publish' }).click();
    await expectToast(page, 'Offer published');
    await expect(page.getByRole('link', { name: /View the live page/ })).toHaveAttribute(
      'href',
      `/freebies/${slug}`
    );

    await page.goto(`/freebies/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/^Last checked /)).toBeVisible();

    await page.goto(`/freebies?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole('article').getByRole('link', { name: title })).toBeVisible();
  });

  test('the list shows it as Published and unpublishing removes it from the site', async ({
    page,
  }) => {
    await page.goto(`/admin/offers?q=${encodeURIComponent(title)}`);
    await waitForPageReady(page);
    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row.getByText('Published')).toBeVisible();

    await row.getByRole('button', { name: `Open menu for ${title}` }).click();
    await page.getByRole('menuitem', { name: 'Unpublish' }).click();
    await expectToast(page, 'Offer unpublished and back to draft');
    await expect(row.getByText('Draft')).toBeVisible();

    const gone = await page.request.get(`/freebies/${slug}`);
    expect(gone.status()).toBe(404);
    await page.goto(`/freebies?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole('article').getByRole('link', { name: title })).toHaveCount(0);
  });

  test('archives it after a confirmation, leaving no way to edit it', async ({ page }) => {
    await page.goto(`/admin/offers?q=${encodeURIComponent(title)}`);
    await waitForPageReady(page);
    const row = page.getByRole('row', { name: new RegExp(title) });

    await row.getByRole('button', { name: `Open menu for ${title}` }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    const dialog = page.getByRole('dialog', { name: 'Archive this offer?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Archive offer' }).click();
    await expectToast(page, 'Offer archived');
    await expect(row.getByText('Archived')).toBeVisible();

    await page.goto(offerPath);
    await waitForPageReady(page);
    await expect(page.getByText(/archived and cannot be changed/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  });
});

test.describe('Admin catalogue pages', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsAdmin(context);
  });

  test('the offers list shows counts from the API, status chips and a labelled search', async ({
    page,
  }) => {
    await page.goto('/admin/offers');
    await waitForPageReady(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Freebies' })).toBeVisible();
    const counts = page
      .getByRole('list', { name: 'Offer counts' })
      .or(page.locator('dl[aria-label="Offer counts"]'));
    await expect(counts).toBeVisible();
    await expect(counts.getByText('Total offers')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Filter by status' })).toBeVisible();
    await expect(page.getByRole('search').getByLabel(/^Search offers/)).toBeVisible();

    await page.getByRole('link', { name: 'Published', exact: true }).click();
    await expect(page).toHaveURL(/status=published/);
    await expect(page.getByRole('link', { name: 'Published', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('categories and merchants list their rows and offer an add form', async ({ page }) => {
    await page.goto('/admin/categories');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
    await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();
    await page.getByRole('link', { name: 'Add category' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Add category' })).toBeVisible();

    await page.goto('/admin/merchants');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Merchants' })).toBeVisible();
    await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();
  });

  for (const width of WIDTHS) {
    test(`has no horizontal scroll and 44px targets at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ADMIN_PAGES) {
        await page.goto(path);
        await waitForPageReady(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);

        const small = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              'main button, main a, main select, main input'
            ),
          ]
            .filter((el) => el.offsetParent !== null)
            .filter(
              (el) => !(el instanceof HTMLInputElement) || !['checkbox', 'hidden'].includes(el.type)
            )
            .filter((el) => !el.closest('p, li > span, td > div > span'))
            .map((el) => ({
              tag: el.tagName,
              name: el.textContent?.trim().slice(0, 30),
              h: el.getBoundingClientRect().height,
            }))
            .filter((el) => el.h > 0 && el.h < 43.5)
        );
        expect(small, `${path} at ${width}px: targets shorter than 44px`).toEqual([]);
      }
    });
  }
});

test.describe('Access control', () => {
  test('sends a signed-in non-admin to /dashboard without passing through /login', async ({
    page,
    context,
  }) => {
    test.skip(!FAKE_PLAIN_COOKIE, 'Needs E2E_PLAIN_SESSION_COOKIE (a verified non-admin session)');
    await setSessionCookie(context, FAKE_PLAIN_COOKIE);

    const visited: string[] = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest()) visited.push(new URL(request.url()).pathname);
    });
    await page.goto('/admin/offers');
    await page.waitForURL(/\/dashboard/);
    expect(visited).not.toContain('/login');
  });

  test('sends a visitor with no session to /login', async ({ page }) => {
    await page.goto('/admin/offers');
    await page.waitForURL(/\/login/);
  });
});
