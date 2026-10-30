import { describe, expect, it } from 'vitest';
import { FILTERED, scrubEvent as scrubOrNull } from '@/lib/sentry/scrub-event';

function scrubEvent<T extends object>(event: T): T {
  const scrubbed = scrubOrNull(event);
  if (scrubbed === null) throw new Error('event was dropped');
  return scrubbed;
}

const URL_WITH_TOKEN = 'https://freejoy.test/alerts/confirm?token=abc&x=1';

function eventForConfirmPage() {
  return {
    message: 'boom',
    request: {
      url: URL_WITH_TOKEN,
      query_string: 'token=abc&x=1',
      headers: { Referer: 'https://freejoy.test/alerts/unsubscribe?x=2&token=abc' },
    },
    transaction: '/alerts/confirm',
    contexts: {
      trace: {
        data: {
          'http.url': URL_WITH_TOKEN,
          'url.full': URL_WITH_TOKEN,
          'http.query': '?token=abc',
        },
      },
    },
    spans: [{ description: `GET ${URL_WITH_TOKEN}`, data: { 'http.url': URL_WITH_TOKEN } }],
    breadcrumbs: [
      { category: 'navigation', data: { from: '/alerts', to: '/alerts/confirm?token=abc' } },
    ],
  };
}

describe('scrubEvent', () => {
  it('leaves no trace of the token anywhere in the event', () => {
    const scrubbed = scrubEvent(eventForConfirmPage());

    expect(JSON.stringify(scrubbed)).not.toContain('abc');
    expect(JSON.stringify(scrubbed)).toContain(`token=${FILTERED}`);
  });

  it('keeps the other query parameters and the page path', () => {
    const scrubbed = scrubEvent(eventForConfirmPage());

    expect(scrubbed.request.url).toBe(`https://freejoy.test/alerts/confirm?token=${FILTERED}&x=1`);
    expect(scrubbed.request.query_string).toBe(`token=${FILTERED}&x=1`);
    expect(scrubbed.request.headers.Referer).toContain('x=2');
    expect(scrubbed.transaction).toBe('/alerts/confirm');
  });

  it('filters a query string held as an object or as name/value pairs', () => {
    const scrubbed = scrubEvent({
      request: { query_string: { token: 'abc', x: '1' } },
      extra: {
        query: [
          ['token', 'abc'],
          ['x', '1'],
        ],
      },
    });

    expect(JSON.stringify(scrubbed)).not.toContain('abc');
    expect(scrubbed.request.query_string).toEqual({ token: FILTERED, x: '1' });
    expect(scrubbed.extra.query).toEqual([
      ['token', FILTERED],
      ['x', '1'],
    ]);
  });

  it('does not touch a key called token outside a query string', () => {
    const event = { extra: { token: 'not-a-query' } };

    expect(scrubEvent(event).extra.token).toBe('not-a-query');
  });

  it('does not mutate the original event', () => {
    const event = eventForConfirmPage();

    scrubEvent(event);

    expect(event.request.url).toBe(URL_WITH_TOKEN);
  });

  it('passes events without tokens through unchanged and survives deep or odd values', () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 40; i++) cursor = (cursor.next = {}) as Record<string, unknown>;
    const event = { message: 'ok', n: 3, nothing: null, list: [1, 'two', { three: 3 }] };

    expect(scrubEvent({ ...event, deep })).toEqual({ ...event, deep: expect.anything() });
  });
});

describe('scrubEvent: router state, cookies and encoded shapes', () => {
  const STATE_TREE = encodeURIComponent(
    '["",{"children":["alerts",{"children":["confirm",{"children":["__PAGE__?{"token":"abc"}",{}]}]}]}]'
  );

  it.each(['next-router-state-tree', 'Next-Router-State-Tree', 'NEXT-ROUTER-STATE-TREE'])(
    'replaces the %s request header and leaves no trace of the token',
    (header) => {
      const scrubbed = scrubEvent({
        request: { headers: { [header]: STATE_TREE, Accept: 'text/html' } },
        extra: { state: STATE_TREE },
      });

      expect(JSON.stringify(scrubbed)).not.toContain('abc');
      expect((scrubbed.request.headers as Record<string, string>)[header]).toBe(FILTERED);
      expect(scrubbed.request.headers.Accept).toBe('text/html');
    }
  );

  it.each([
    ['JSON', '{"token":"abc","x":1}'],
    ['JSON with spaces', '{ "token" : "abc" }'],
    ['escaped JSON', '{\\"token\\":\\"abc\\"}'],
    ['percent-encoded JSON', '%7B%22token%22%3A%22abc%22%7D'],
    ['lower-case percent-encoding', '%7b%22token%22%3a%22abc%22%7d'],
    ['a plain query', '/alerts/confirm?x=1&token=abc'],
    ['a semicolon query', '/alerts/confirm;token=abc'],
  ])('removes a token written as %s', (_name, text) => {
    const scrubbed = scrubEvent({ message: text, extra: { nested: [text] } });

    expect(JSON.stringify(scrubbed)).not.toContain('abc');
  });

  it('keeps the rest of a JSON string', () => {
    expect(scrubEvent({ message: '{"token":"abc","x":1}' }).message).toBe(
      `{"token":"${FILTERED}","x":1}`
    );
  });

  it('drops cookie headers and cookies from the request', () => {
    const scrubbed = scrubEvent({
      request: {
        headers: { Cookie: 'session=s1', cookie: 'a=b', 'Set-Cookie': 'x=y', Accept: '*/*' },
        cookies: { session: 's1' },
      },
    });

    expect(JSON.stringify(scrubbed)).not.toMatch(/s1|a=b|x=y/);
    expect(scrubbed.request.headers).toEqual({ Accept: '*/*' });
    expect(scrubbed.request).not.toHaveProperty('cookies');
  });
});

describe('scrubEvent: objects it must not rebuild', () => {
  class Metadata {
    constructor(public readonly url: string) {}
  }

  it('keeps sdkProcessingMetadata by reference, without walking it', () => {
    const metadata = new Metadata('https://freejoy.test/alerts/confirm?token=abc');
    const event = { message: 'x', sdkProcessingMetadata: metadata };

    const scrubbed = scrubEvent(event);

    expect(scrubbed.sdkProcessingMetadata).toBe(metadata);
  });

  it('keeps other class instances, such as dates, as they are', () => {
    const when = new Date('2026-10-30T00:00:00Z');

    const scrubbed = scrubEvent({ extra: { when } });

    expect(scrubbed.extra.when).toBe(when);
  });
});
