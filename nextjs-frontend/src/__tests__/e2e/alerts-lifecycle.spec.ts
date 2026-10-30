import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';
import type { Page } from '@playwright/test';
import { DB_SEAM, subscriberStatus } from './helpers/db-seam';
import { EMAIL_OUTBOX, linkIn, outboxFor, relativeLink, uniqueEmail } from './helpers/email-outbox';
import { expectNoHorizontalOverflow } from './helpers/page-checks';

/**
 * Money path 2 (FREEJ-27): the alerts double opt-in lifecycle in a browser, against a real backend with the FAKE email
 * provider (nothing is ever sent). Runs in the money-desktop and money-mobile (390px) projects, with no login.
 *
 *   npm run test:e2e:local -- outbound alerts-lifecycle      (setup and variables: docs/developer/local-e2e.md)
 *
 * Needs E2E_EMAIL_OUTBOX, the file the backend (EMAIL_PROVIDER=fake, EMAIL_FAKE_OUTBOX=<same file>, ENVIRONMENT local or
 * test) appends each message to, and a server started with ALERTS_FORM_LIVE=true (a public run sets it). The links are
 * read from that file the way a person reads their inbox. The optional database seam (E2E_PSQL) additionally checks the
 * stored status; without it those checks are skipped.
 *
 * Every address is new for the run (helpers/email-outbox.ts), so a reused database never turns a sign-up into a
 * re-submission, and the fake backend's limiter is off (ENVIRONMENT local/test), so repeated runs are safe.
 *
 * Replaces alerts-optin.spec.ts (FREEJ-24), whose three tests are all covered here: the sign-up -> confirm -> replay ->
 * unsubscribe flow and the same-answer/no-second-mail rule (test 1) and the one-click POST (test 2).
 */

test.skip(
  !EMAIL_OUTBOX,
  'Needs E2E_EMAIL_OUTBOX (a backend with the fake email provider) and a server started with ALERTS_FORM_LIVE=true'
);

const SUBMIT = 'Send me free alerts';
const PENDING_HEADING = 'Check your inbox';
const NARROW_PHONE = 320;

/** Fills the form on a fresh /alerts page and submits it; resolves once the pending panel is shown. */
async function submitAlertsForm(page: Page, email: string): Promise<void> {
  await page.goto('/alerts');
  await waitForPageReady(page);
  await page.getByLabel('Email address').fill(email);
  await page
    .getByRole('group', { name: /interested in/i })
    .locator('label')
    .first()
    .click();
  await page.getByText('Weekly round-up', { exact: true }).click();
  await page.getByRole('checkbox', { name: /i agree to receive freebie emails/i }).check();
  await page.getByRole('button', { name: SUBMIT }).click();
  await expect(page.getByRole('heading', { name: PENDING_HEADING })).toBeVisible();
}

/** What the visitor reads once the form has been answered. */
const answerText = (page: Page) => page.getByRole('main').innerText();

async function pressButtonOnLink(page: Page, link: string, button: string, heading: string) {
  await page.goto(link);
  await waitForPageReady(page);
  await page.getByRole('button', { name: button }).click();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

function expectStatus(email: string, status: string): void {
  if (!DB_SEAM) return;
  expect(subscriberStatus(email), `stored status of ${email}`).toBe(status);
}

test.describe('Money path: alerts opt-in lifecycle', () => {
  test.beforeEach(() => {
    if (DB_SEAM) return;
    test.info().annotations.push({
      type: 'not checked',
      description: 'the stored subscriber status: E2E_PSQL is not set',
    });
  });

  test('opt in, confirm, unsubscribe; every resubmission gets the same answer and no further email', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail('lifecycle');
    const sentinel = uniqueEmail('sentinel');

    await test.step('valid preferences show the pending message and send one email', async () => {
      await submitAlertsForm(page, email);
      await expectNoHorizontalOverflow(page, 'the pending message');
      await expect.poll(() => outboxFor(email).length).toBe(1);
      expect(outboxFor(email)[0].headers['List-Unsubscribe-Post']).toBe(
        'List-Unsubscribe=One-Click'
      );
      expectStatus(email, 'PENDING');
    });
    const pendingAnswer = await answerText(page);
    const mail = outboxFor(email)[0];
    const confirmLink = linkIn(mail.text, '/alerts/confirm');
    const unsubscribeLink = linkIn(mail.text, '/alerts/unsubscribe');

    await test.step('submitting again while pending: the same answer', async () => {
      await page.getByRole('button', { name: 'Use a different address' }).click();
      await page.getByRole('button', { name: SUBMIT }).click();
      await expect(page.getByRole('heading', { name: PENDING_HEADING })).toBeVisible();
      expect(await answerText(page)).toBe(pendingAnswer);
      expectStatus(email, 'PENDING');
    });

    await test.step('the confirmation link only asks; the button confirms', async () => {
      await page.goto(confirmLink);
      await waitForPageReady(page);
      await expect(page.getByRole('heading', { name: 'Confirm your free alerts' })).toBeVisible();
      expect(new URL(page.url()).search).toBe('');
      expectStatus(email, 'PENDING');
      await expectNoHorizontalOverflow(page, 'the confirmation page');
      await page.getByRole('button', { name: 'Confirm my alerts' }).click();
      await expect(page.getByRole('heading', { name: 'You are signed up' })).toBeVisible();
      await expectNoHorizontalOverflow(page, 'the confirmed page');
      expectStatus(email, 'CONFIRMED');
    });

    await test.step('the used confirmation link is refused', async () => {
      await page.goto(confirmLink);
      await waitForPageReady(page);
      await page.getByRole('button', { name: 'Confirm my alerts' }).click();
      await expect(page.getByText(/not valid any more/i)).toBeVisible();
    });

    await test.step('submitting again once confirmed: the same answer', async () => {
      await submitAlertsForm(page, email);
      expect(await answerText(page)).toBe(pendingAnswer);
      expectStatus(email, 'CONFIRMED');
    });

    await test.step('the unsubscribe link unsubscribes', async () => {
      await pressButtonOnLink(page, unsubscribeLink, 'Unsubscribe me', 'You are unsubscribed');
      await expectNoHorizontalOverflow(page, 'the unsubscribed page');
      expectStatus(email, 'UNSUBSCRIBED');
    });

    await test.step('submitting again once unsubscribed: the same answer, and the address is NOT reopened', async () => {
      await submitAlertsForm(page, email);
      expect(await answerText(page)).toBe(pendingAnswer);
      expectStatus(email, 'UNSUBSCRIBED');
    });

    await test.step('no second email was sent to the address', async () => {
      // Absence cannot be polled for. A later sign-up is the barrier: the backend sends after its response, in
      // order, so once the sentinel's email is in the outbox any email owed to the earlier submissions is there too.
      await submitAlertsForm(page, sentinel);
      await expect.poll(() => outboxFor(sentinel).length).toBe(1);
      expect(outboxFor(email)).toHaveLength(1);
    });
  });

  test('the List-Unsubscribe URL works as a one-click POST, twice, and a forged one is refused', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('one-click');
    await submitAlertsForm(page, email);
    await expect.poll(() => outboxFor(email).length).toBe(1);
    const header = outboxFor(email)[0].headers['List-Unsubscribe'];
    const oneClick = relativeLink(header.slice(1, -1));
    expect(oneClick).toMatch(/^\/alerts\/unsubscribe\/one-click\?token=/);

    const first = await request.post(oneClick, {
      form: { 'List-Unsubscribe': 'One-Click' },
      maxRedirects: 0,
    });
    const second = await request.post(oneClick, {
      form: { 'List-Unsubscribe': 'One-Click' },
      maxRedirects: 0,
    });

    expect([first.status(), second.status()]).toEqual([200, 200]);
    expectStatus(email, 'UNSUBSCRIBED');
    const forged = await request.post('/alerts/unsubscribe/one-click?token=forged.token', {
      form: { 'List-Unsubscribe': 'One-Click' },
    });
    expect(forged.status()).toBe(400);
  });

  test(`the form and its pending message fit a ${NARROW_PHONE}px phone`, async ({ page }) => {
    await page.setViewportSize({ width: NARROW_PHONE, height: 700 });
    await page.goto('/alerts');
    await waitForPageReady(page);
    await expectNoHorizontalOverflow(page, `the form at ${NARROW_PHONE}px`);

    await submitAlertsForm(page, uniqueEmail('narrow'));

    await expectNoHorizontalOverflow(page, `the pending message at ${NARROW_PHONE}px`);
  });
});
