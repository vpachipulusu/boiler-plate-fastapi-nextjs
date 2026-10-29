import { afterEach, describe, expect, it, vi } from 'vitest';
import { absoluteTemplateUrl, absoluteUrl, siteOrigin } from '@/lib/seo/urls';

afterEach(() => vi.unstubAllEnvs());

function stubEnv(env: Record<string, string>) {
  for (const key of ['NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_URL']) vi.stubEnv(key, '');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

describe('siteOrigin in development and test', () => {
  it('falls back to localhost when nothing is configured', () => {
    stubEnv({ NODE_ENV: 'test' });

    expect(siteOrigin()).toBe('http://localhost:3000');
  });

  it('uses the configured value and strips trailing slashes', () => {
    stubEnv({ NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://example.test:4000//' });

    expect(siteOrigin()).toBe('http://example.test:4000');
  });
});

describe('siteOrigin in production', () => {
  it('throws when NEXT_PUBLIC_APP_URL is unset and the app is not on Vercel', () => {
    stubEnv({ NODE_ENV: 'production' });

    expect(() => siteOrigin()).toThrow(/NEXT_PUBLIC_APP_URL must be set/);
  });

  it('accepts an https origin and strips the trailing slash', () => {
    stubEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://freejoy.example/' });

    expect(siteOrigin()).toBe('https://freejoy.example');
  });

  it('rejects a non-https public origin and a malformed one', () => {
    stubEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://freejoy.example' });
    expect(() => siteOrigin()).toThrow(/must use https/);

    stubEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'not a url' });
    expect(() => siteOrigin()).toThrow(/not a valid URL/);
  });

  it('allows a loopback http origin, which CI and the local e2e build use', () => {
    stubEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' });

    expect(siteOrigin()).toBe('http://localhost:3000');
  });

  it('falls back to the Vercel deployment URL when it is set there without a configured value', () => {
    stubEnv({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'freejoy-git.vercel.app',
    });

    expect(siteOrigin()).toBe('https://freejoy-git.vercel.app');
  });

  it('does not throw on Vercel with nothing configured and no deployment URL', () => {
    stubEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production' });

    expect(siteOrigin()).toBe('http://localhost:3000');
  });
});

describe('absoluteUrl', () => {
  it('joins a path to the origin, adding the leading slash', () => {
    stubEnv({ NODE_ENV: 'test' });

    expect(absoluteUrl('/freebies')).toBe('http://localhost:3000/freebies');
    expect(absoluteUrl('freebies')).toBe('http://localhost:3000/freebies');
    expect(absoluteUrl('/')).toBe('http://localhost:3000/');
  });

  it('percent-encodes each segment so a slug cannot change the URL shape', () => {
    stubEnv({ NODE_ENV: 'test' });

    expect(absoluteUrl('/freebies/a b?x=1#frag')).toBe(
      'http://localhost:3000/freebies/a%20b%3Fx%3D1%23frag'
    );
    expect(absoluteUrl('/freebies/a/b')).toBe('http://localhost:3000/freebies/a/b');
  });

  it('keeps the placeholder braces of a fixed template', () => {
    stubEnv({ NODE_ENV: 'test' });

    expect(absoluteTemplateUrl('/freebies?q={search_term_string}')).toBe(
      'http://localhost:3000/freebies?q={search_term_string}'
    );
    expect(absoluteTemplateUrl('freebies')).toBe('http://localhost:3000/freebies');
  });
});
