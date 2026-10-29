import { describe, expect, it } from 'vitest';
import { FILTERED, scrubEvent } from '@/lib/sentry/scrub-token';

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
    const event = { message: 'ok', n: 3, nothing: null, deep, list: [1, 'two', { three: 3 }] };

    expect(scrubEvent(event)).toEqual(event);
  });
});
