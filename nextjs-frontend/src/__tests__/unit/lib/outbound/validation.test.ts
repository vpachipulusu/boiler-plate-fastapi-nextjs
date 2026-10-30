import { describe, expect, it } from 'vitest';
import {
  classifyUserAgent,
  isOfferId,
  isOfferSlug,
  parseHttpsDestination,
  referrerHost,
} from '@/lib/outbound/validation';

describe('isOfferId', () => {
  it.each(['clx8f3k2a0000abcd1234efgh', 'offer-01', 'a_b-C9', 'a'.repeat(64)])('accepts %s', (id) =>
    expect(isOfferId(id)).toBe(true)
  );

  it.each([
    '',
    'a'.repeat(65),
    'a b',
    'a/b',
    '..',
    'a.b',
    '%2e%2e',
    'id\r\nx',
    'id?x=1',
    'id;x',
    'ünï',
    '//evil.com',
    undefined,
    42,
  ])('rejects %s', (id) => expect(isOfferId(id)).toBe(false));
});

describe('isOfferSlug', () => {
  it('accepts catalogue slugs', () => {
    expect(isOfferSlug('free-shampoo')).toBe(true);
    expect(isOfferSlug('a1')).toBe(true);
  });

  it.each(['', 'Free', '-a', 'a-', 'a--b', 'a/b', '../x', 'a b', 'a'.repeat(101), null])(
    'rejects %s',
    (slug) => expect(isOfferSlug(slug)).toBe(false)
  );
});

describe('parseHttpsDestination', () => {
  it('returns a URL for a clean https destination and keeps its query exactly', () => {
    const url = parseHttpsDestination('https://www.awin1.com/cread.php?a=1&b=%20x');

    expect(url?.href).toBe('https://www.awin1.com/cread.php?a=1&b=%20x');
    expect(url?.protocol).toBe('https:');
  });

  it('accepts a punycode host: it is ASCII', () => {
    expect(parseHttpsDestination('https://xn--bcher-kva.example/x')?.hostname).toBe(
      'xn--bcher-kva.example'
    );
  });

  it('accepts a host whose last label only starts with a digit', () => {
    expect(parseHttpsDestination('https://shop.example/1')?.hostname).toBe('shop.example');
    expect(parseHttpsDestination('https://a.co.uk/x')?.hostname).toBe('a.co.uk');
  });

  it('accepts a 253 character host and a 63 character label', () => {
    const label63 = 'a'.repeat(63);
    const host253 = `${label63}.${label63}.${label63}.${'b'.repeat(57)}.com`;
    expect(host253.length).toBe(253);
    expect(parseHttpsDestination(`https://${host253}/x`)?.hostname).toBe(host253);
  });

  it('accepts hyphens inside a label', () => {
    expect(parseHttpsDestination('https://my-shop.co-op.example/x')?.hostname).toBe(
      'my-shop.co-op.example'
    );
  });

  it('accepts the default port written out', () => {
    expect(parseHttpsDestination('https://shop.example:443/x')?.host).toBe('shop.example');
  });

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['mixed case javascript', 'JaVaScRiPt:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['http', 'http://shop.example/'],
    ['ftp', 'ftp://shop.example/'],
    ['protocol relative', '//evil.example/x'],
    ['relative path', '/freebies'],
    ['no scheme', 'shop.example/x'],
    ['userinfo', 'https://good.example@evil.example/'],
    ['userinfo with password', 'https://good.example:pw@evil.example/'],
    ['backslash host trick', 'https://evil.example\\@good.example/'],
    ['backslash path', 'https://good.example\\evil'],
    ['CRLF', 'https://good.example/x\r\nSet-Cookie: a=b'],
    ['LF', 'https://good.example/x\nLocation: https://evil.example'],
    ['tab', 'https://good.example/\tx'],
    ['space', 'https://good.example/a b'],
    ['NUL', 'https://good.example/\u0000'],
    ['C1 control', 'https://good.example/\u0085'],
    ['custom port', 'https://good.example:8443/'],
    ['percent-encoded host', 'https://%77ww.example.com/x'],
    ['percent-encoded dot', 'https://www%2eexample.com/x'],
    [
      '254 character host',
      `https://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com/`,
    ],
    ['64 character label', `https://${'a'.repeat(64)}.example/`],
    ['leading hyphen label', 'https://-bad.example.com/'],
    ['trailing hyphen label', 'https://bad-.example.com/'],
    ['underscore label', 'https://bad_name.example.com/'],
    ['empty label', 'https://bad..example.com/'],
    ['IPv6 literal', 'https://[::1]/x'],
    ['IPv4', 'https://127.0.0.1/x'],
    ['decimal IPv4', 'https://2130706433/'],
    ['hex IPv4', 'https://0x7f.0.0.1/'],
    ['numeric last label', 'https://shop.example.123/'],
    ['hex last label', 'https://shop.0x1f/'],
    ['single label', 'https://localhost/x'],
    ['trailing dot', 'https://good.example./x'],
    ['trailing dot with port', 'https://good.example.:443/x'],
    ['IDN host', 'https://bücher.example/'],
    ['Cyrillic lookalike', 'https://аwin1.com/x'],
    ['non-ASCII path', 'https://good.example/café'],
    ['fullwidth dot', 'https://www.awin1.com。evil.example/'],
    ['empty host', 'https:///path'],
    ['no slashes', 'https:good.example/x'],
    ['one slash', 'https:/good.example/x'],
    ['four slashes', 'https:////good.example/x'],
    ['empty string', ''],
    ['over long', `https://good.example/${'a'.repeat(2100)}`],
    ['not a string', 42],
    ['null', null],
  ])('refuses %s', (_name, value) => {
    expect(parseHttpsDestination(value)).toBeNull();
  });
});

describe('referrerHost', () => {
  it('keeps only the lower-cased host of an http(s) referrer', () => {
    expect(referrerHost('https://News.Example:8443/a/b?token=secret#frag')).toBe('news.example');
    expect(referrerHost('http://user:pw@old.example/x')).toBe('old.example');
  });

  it.each([
    null,
    '',
    'not a url',
    'javascript:alert(1)',
    'android-app://com.google',
    'about:blank',
  ])('returns null for %s', (value) => expect(referrerHost(value)).toBeNull());
});

describe('classifyUserAgent', () => {
  const cases: [string, string | null][] = [
    [
      'DESKTOP',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
    ],
    [
      'DESKTOP',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    ],
    ['DESKTOP', 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'],
    [
      'MOBILE',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    ],
    [
      'MOBILE',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
    ],
    ['TABLET', 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'],
    [
      'TABLET',
      'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
    ],
    ['BOT', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['BOT', 'Slackbot-LinkExpanding 1.0'],
    ['BOT', 'curl/8.4.0'],
    ['BOT', 'Mozilla/5.0 HeadlessChrome/126.0'],
    ['OTHER', 'SomethingUnknown/1.0'],
    ['OTHER', ''],
    ['OTHER', null],
  ];

  it.each(cases)('classifies as %s: %s', (expected, agent) => {
    expect(classifyUserAgent(agent)).toBe(expected);
  });
});
