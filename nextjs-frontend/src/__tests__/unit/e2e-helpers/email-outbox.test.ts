import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { linkIn, outboxFor, relativeLink, uniqueEmail } from '../../e2e/helpers/email-outbox';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function outboxFile(lines: object[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'outbox-'));
  dirs.push(dir);
  const file = path.join(dir, 'outbox.jsonl');
  writeFileSync(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  return file;
}

const message = (to: string, text = 'hello') => ({ to, subject: 'Subject', text, headers: {} });

describe('outboxFor', () => {
  it('returns only the messages for the address, oldest first', () => {
    const file = outboxFile([
      message('a@example.com', '1'),
      message('b@example.com'),
      message('a@example.com', '2'),
    ]);

    expect(outboxFor('a@example.com', file).map((mail) => mail.text)).toEqual(['1', '2']);
    expect(outboxFor('nobody@example.com', file)).toEqual([]);
  });

  it('is empty when the outbox is not configured or does not exist yet', () => {
    expect(outboxFor('a@example.com', undefined)).toEqual([]);
    expect(outboxFor('a@example.com', path.join(tmpdir(), 'no-such-outbox.jsonl'))).toEqual([]);
  });
});

describe('linkIn', () => {
  const body =
    'Open this link:\nhttp://localhost:3271/alerts/confirm?token=abc.DEF-1_2\n\n' +
    'or never email me:\nhttp://localhost:3271/alerts/unsubscribe?token=xyz.789\n';

  it('finds each link by its path and returns it relative to the origin under test', () => {
    expect(linkIn(body, '/alerts/confirm')).toBe('/alerts/confirm?token=abc.DEF-1_2');
    expect(linkIn(body, '/alerts/unsubscribe')).toBe('/alerts/unsubscribe?token=xyz.789');
  });

  it('does not mistake the one-click URL for the unsubscribe page', () => {
    expect(() =>
      linkIn('http://h/alerts/unsubscribe/one-click?token=t', '/alerts/unsubscribe')
    ).toThrow('no /alerts/unsubscribe link in the email');
  });

  it('throws when the email has no such link', () => {
    expect(() => linkIn('nothing here', '/alerts/confirm')).toThrow('no /alerts/confirm link');
  });
});

describe('relativeLink', () => {
  it('keeps the path and query only', () => {
    expect(relativeLink('https://elsewhere.example/a/b?token=t')).toBe('/a/b?token=t');
  });
});

describe('uniqueEmail', () => {
  it('is lower case, an example.com address and different every call', () => {
    const first = uniqueEmail('Life Cycle!');
    const second = uniqueEmail('Life Cycle!');

    expect(first).toMatch(/^e2e-\d+-[0-9a-f]{8}-life-cycle-@example\.com$/);
    expect(first).toBe(first.toLowerCase());
    expect(first).not.toBe(second);
  });
});
