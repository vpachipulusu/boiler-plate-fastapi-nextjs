/** The post-sign-in redirect helper: only a safe same-origin path gets through, everything else is /dashboard. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGN_IN_REDIRECT,
  MAX_REDIRECT_LENGTH,
  resolveSafeRedirect,
} from '@/lib/auth/safe-redirect';

/** Built from the char code so no source-level escaping can change what is tested. */
const BS = String.fromCharCode(0x5c);
const TAB = String.fromCharCode(0x09);
const LF = String.fromCharCode(0x0a);
const CR = String.fromCharCode(0x0d);
const NUL = String.fromCharCode(0x00);
const DEL = String.fromCharCode(0x7f);
const C1_NEL = String.fromCharCode(0x85);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const RTL_OVERRIDE = String.fromCharCode(0x202e);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const FULLWIDTH_SOLIDUS = String.fromCharCode(0xff0f);

describe('resolveSafeRedirect: accepted paths', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/users', '/admin/users'],
    ['/dashboard/settings', '/dashboard/settings'],
    ['/', '/'],
    ['/freebies?q=tea&page=2', '/freebies?q=tea&page=2'],
    ['/pricing#plans', '/pricing#plans'],
    ['/category/food-and-drink', '/category/food-and-drink'],
    ['/admin/offers/caf%C3%A9', '/admin/offers/caf%C3%A9'],
    ['/a b', '/a%20b'],
    ['/@evil.com', '/@evil.com'],
    ['/javascript:alert(1)', '/javascript:alert(1)'],
    ['/admin?next=%2Fdashboard', '/admin?next=%2Fdashboard'],
    ['/x/./y', '/x/y'],
  ])('keeps %s as %s', (raw, expected) => {
    expect(resolveSafeRedirect(raw)).toBe(expected);
  });

  it('accepts a path of exactly the maximum length and refuses one character more', () => {
    const atLimit = `/${'a'.repeat(MAX_REDIRECT_LENGTH - 1)}`;
    expect(resolveSafeRedirect(atLimit)).toBe(atLimit);
    expect(resolveSafeRedirect(`${atLimit}a`)).toBe(DEFAULT_SIGN_IN_REDIRECT);
  });

  it('returns a path rebuilt from the parsed URL, not the raw text', () => {
    expect(resolveSafeRedirect('/admin/../admin/users')).toBe('/admin/users');
  });
});

describe('resolveSafeRedirect: open-redirect corpus', () => {
  const corpus: Array<[string, unknown]> = [
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/admin'],
    ['slash backslash', `/${BS}evil.com`],
    ['double backslash', `${BS}${BS}evil.com`],
    ['single backslash first', `${BS}evil.com`],
    ['backslash later in the path', `/admin${BS}users`],
    ['absolute https', 'https://evil.com'],
    ['absolute http', 'http://evil.com/admin'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['scheme after a slash', '/https://evil.com'],
    ['scheme in the query', '/admin?u=https://evil.com'],
    ['encoded slash then host', '/%2F/evil.com'],
    ['encoded slash pair', '/%2F%2Fevil.com'],
    ['encoded backslash', '/%5Cevil.com'],
    ['lowercase encoded backslash', '/%5cevil.com'],
    ['double-encoded backslash', '/%255Cevil.com'],
    ['double-encoded slash', '/%252F%252Fevil.com'],
    ['encoded scheme separator', '/x?u=https%3A%2F%2Fevil.com'],
    ['double-encoded scheme separator', '/x?u=https%253A%252F%252Fevil.com'],
    ['tab inside', `/${TAB}/evil.com`],
    ['tab after the slash', `/${TAB}evil.com`],
    ['carriage return', `/${CR}/evil.com`],
    ['line feed', `/${LF}evil.com`],
    ['encoded tab', '/%09/evil.com'],
    ['encoded line feed', '/%0Aevil.com'],
    ['double-encoded carriage return', '/%250Devil.com'],
    ['null byte', `/admin${NUL}`],
    ['encoded null byte', '/admin%00'],
    ['DEL', `/admin${DEL}`],
    ['C1 control', `/admin${C1_NEL}`],
    ['line separator', `/admin${LINE_SEPARATOR}`],
    ['right-to-left override', `/admin${RTL_OVERRIDE}`],
    ['zero-width space', `/${ZERO_WIDTH_SPACE}evil.com`],
    ['byte order mark', `/${BYTE_ORDER_MARK}evil.com`],
    ['triple slash', '///evil.com'],
    ['dot segments to a protocol-relative path', '/.//evil.com'],
    ['dot-dot segments to a protocol-relative path', '/..//evil.com'],
    ['encoded dot segments to a protocol-relative path', '/%2e%2e//evil.com'],
    ['fullwidth slash pair', `${FULLWIDTH_SOLIDUS}${FULLWIDTH_SOLIDUS}evil.com`],
    ['leading space', ' /admin'],
    ['leading space then host', ' //evil.com'],
    ['no leading slash', 'admin'],
    ['relative dot path', './admin'],
    ['empty', ''],
    ['only spaces', '   '],
    ['malformed escape', '/admin%'],
    ['malformed escape after a good one', '/a%2'],
    ['malformed second decode', '/100%25'],
    ['array', ['/admin']],
    ['array of two', ['/admin', '//evil.com']],
    ['null', null],
    ['undefined', undefined],
    ['number', 5],
    ['object', { toString: () => '/admin' }],
    ['very long', `/${'a'.repeat(5000)}`],
    ['very long host', `//${'a'.repeat(5000)}.com`],
  ];

  it.each(corpus)('falls back to /dashboard for %s', (_name, raw) => {
    expect(resolveSafeRedirect(raw)).toBe(DEFAULT_SIGN_IN_REDIRECT);
  });

  it('keeps a fullwidth slash after the first slash on this origin, percent-encoded', () => {
    const result = resolveSafeRedirect(`/${FULLWIDTH_SOLIDUS}evil.com`);
    expect(new URL(result, 'http://localhost').origin).toBe('http://localhost');
    expect(result.startsWith('//')).toBe(false);
  });

  it('never returns a value that could leave the origin, for any corpus entry', () => {
    for (const [, raw] of corpus) {
      const result = resolveSafeRedirect(raw);
      const url = new URL(result, 'http://localhost');
      expect(url.origin).toBe('http://localhost');
      expect(result.startsWith('/')).toBe(true);
      expect(result.startsWith('//')).toBe(false);
      expect(result.includes(BS)).toBe(false);
      expect([...result].every((char) => (char.codePointAt(0) ?? 0) > 0x1f)).toBe(true);
    }
  });
});

describe('resolveSafeRedirect: sign-in pages and route handlers', () => {
  it.each([
    '/login',
    '/login/',
    '/login?redirect=/admin',
    '/login#x',
    '/signup',
    '/signup?plan=pro',
    '/reset-password',
    '/verify-email',
    '/verify-email/anything',
    '/LOGIN',
    '/Login',
    '/%6Cogin',
    '/%256Cogin',
    '/x/../login',
    '/x/%2e%2e/login',
    '/./login',
    '/api',
    '/api/',
    '/api/auth/clear-session',
    '/api/health',
    '/API/health',
    '/%61pi/health',
    '/go/abc123',
    '/alerts/unsubscribe/one-click',
    '/_next/static/chunk.js',
  ])('falls back to /dashboard for %s', (raw) => {
    expect(resolveSafeRedirect(raw)).toBe(DEFAULT_SIGN_IN_REDIRECT);
  });

  it.each(['/loginfoo', '/apiary', '/going', '/signups', '/alerts', '/alerts/unsubscribe'])(
    'keeps %s: only the exact page or its sub-paths are refused',
    (raw) => {
      expect(resolveSafeRedirect(raw)).toBe(raw);
    }
  );
});
