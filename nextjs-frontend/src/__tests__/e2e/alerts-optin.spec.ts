import { readFileSync, existsSync } from 'node:fs';
import { test, expect } from './helpers/fixtures';
import { waitForPageReady } from './helpers/e2e-utils';

/**
 * Alerts double opt-in against a real backend using the FAKE email provider (nothing is ever sent).
 *
 * Needs E2E_EMAIL_OUTBOX: the file the backend appends each message to as a JSON line. Start the backend with
 * EMAIL_PROVIDER=fake and EMAIL_FAKE_OUTBOX=<that file> (only allowed when ENVIRONMENT is local or test), plus
 * SUBSCRIBER_TOKEN_SECRET. The spec reads the confirm and unsubscribe links from that file, the way a person
 * would from their inbox. Skipped unless E2E_EMAIL_OUTBOX is set and the build has ALERTS_FORM_LIVE=true
 * (run with E2E_ALERTS_LIVE=1). See docs/developer/backend-subscribers.md.
 */

const OUTBOX = process.env.E2E_EMAIL_OUTBOX;

interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
}

function outboxFor(email: string): OutboxMessage[] {
  if (!OUTBOX || !existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxMessage)
    .filter((message) => message.to === email);
}

/** The path and query of a link, so it opens on the origin under test whatever the email says. */
function relative(link: string): string {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

function linkIn(text: string, path: string): string {
  const found = new RegExp(`https?://[^\\s]+${path}\\?token=[A-Za-z0-9._-]+`).exec(text);
  if (!found) throw new Error(`no ${path} link in the email`);
  return relative(found[0]);
}

test.describe('Alerts double opt-in', () => {
  test.skip(
    !OUTBOX || process.env.E2E_ALERTS_LIVE !== '1',
    'needs E2E_EMAIL_OUTBOX (backend with the fake email provider) and a build with ALERTS_FORM_LIVE=true plus E2E_ALERTS_LIVE=1'
  );

  async function signUp(page: import('@playwright/test').Page, email: string) {
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
    await page.getByRole('button', { name: 'Send me free alerts' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  }

  test('sign up, confirm, replay is refused, unsubscribe', async ({ page }) => {
    const email = `e2e-${Date.now()}-a@example.com`;
    await signUp(page, email);

    await expect.poll(() => outboxFor(email).length).toBe(1);
    const mail = outboxFor(email)[0];
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const confirmLink = linkIn(mail.text, '/alerts/confirm');
    const unsubscribeLink = linkIn(mail.text, '/alerts/unsubscribe');

    // Opening the link changes nothing; the person presses the button.
    await page.goto(confirmLink);
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { name: 'Confirm your free alerts' })).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await page.getByRole('button', { name: 'Confirm my alerts' }).click();
    await expect(page.getByRole('heading', { name: 'You are signed up' })).toBeVisible();

    await page.goto(confirmLink);
    await waitForPageReady(page);
    await page.getByRole('button', { name: 'Confirm my alerts' }).click();
    await expect(page.getByText(/not valid any more/i)).toBeVisible();

    await page.goto(unsubscribeLink);
    await waitForPageReady(page);
    await page.getByRole('button', { name: 'Unsubscribe me' }).click();
    await expect(page.getByRole('heading', { name: 'You are unsubscribed' })).toBeVisible();
  });

  test('a second submission for the same address gets the same answer and no second email', async ({
    page,
  }) => {
    const email = `e2e-${Date.now()}-b@example.com`;
    await signUp(page, email);
    await expect.poll(() => outboxFor(email).length).toBe(1);
    const firstPanel = await page.getByRole('heading', { name: 'Check your inbox' }).textContent();

    await page.getByRole('button', { name: 'Use a different address' }).click();
    await page.getByRole('button', { name: 'Send me free alerts' }).click();

    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toHaveText(
      firstPanel ?? ''
    );
    expect(outboxFor(email)).toHaveLength(1);
  });

  test('the List-Unsubscribe URL works as a one-click POST, twice', async ({ page, request }) => {
    const email = `e2e-${Date.now()}-c@example.com`;
    await signUp(page, email);
    await expect.poll(() => outboxFor(email).length).toBe(1);
    const header = outboxFor(email)[0].headers['List-Unsubscribe'];
    const oneClick = relative(header.slice(1, -1));
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
    const forged = await request.post('/alerts/unsubscribe/one-click?token=forged.token', {
      form: { 'List-Unsubscribe': 'One-Click' },
    });
    expect(forged.status()).toBe(400);
  });
});
