import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The fake email provider's outbox, read the way a person reads their inbox. Start the backend with
 * EMAIL_PROVIDER=fake and EMAIL_FAKE_OUTBOX=<file> (only allowed when ENVIRONMENT is local or test) and give the same
 * path to the specs as E2E_EMAIL_OUTBOX. Nothing is ever sent; the backend appends one JSON line per message.
 */

export const EMAIL_OUTBOX = process.env.E2E_EMAIL_OUTBOX;

export interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
}

/** Messages addressed to `email`, oldest first. Empty when the outbox file does not exist yet. */
export function outboxFor(
  email: string,
  outbox: string | undefined = EMAIL_OUTBOX
): OutboxMessage[] {
  if (!outbox || !existsSync(outbox)) return [];
  return readFileSync(outbox, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxMessage)
    .filter((message) => message.to === email);
}

/** The path and query of a link, so it opens on the origin under test whatever the email says. */
export function relativeLink(link: string): string {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

/** The first `<origin>/<path>?token=...` link in an email body, as a path and query. Throws when there is none. */
export function linkIn(text: string, path: string): string {
  const found = new RegExp(`https?://[^\\s]+${path}\\?token=[A-Za-z0-9._-]+`).exec(text);
  if (!found) throw new Error(`no ${path} link in the email`);
  return relativeLink(found[0]);
}

/**
 * A new, lower-case address no earlier run used, so a reused database never turns a sign-up into a re-submission.
 * `example.com` is reserved for documentation; the fake provider never sends to it.
 */
export function uniqueEmail(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `e2e-${Date.now()}-${randomUUID().slice(0, 8)}-${slug}@example.com`;
}
