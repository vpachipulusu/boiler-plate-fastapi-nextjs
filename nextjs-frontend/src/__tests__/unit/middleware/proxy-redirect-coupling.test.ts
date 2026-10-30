// @vitest-environment node
import { readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { resetRateLimitStore } from '@/lib/middleware/rate-limit';
import { DEFAULT_SIGN_IN_REDIRECT, resolveSafeRedirect } from '@/lib/auth/safe-redirect';

/**
 * FREEJ-41: two couplings between the proxy, the route tree and `resolveSafeRedirect` that no single test of
 * either side would notice breaking.
 */

const APP_DIR = resolve(__dirname, '../../../app');

function routeHandlerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeHandlerFiles(path);
    return /^route\.(ts|tsx|js)$/.test(entry.name) ? [path] : [];
  });
}

/** `app/(public)/go/[offerId]/route.ts` -> `/go/sample`: route groups dropped, a sample in each dynamic segment. */
function urlPathOf(file: string): string {
  const segments = relative(APP_DIR, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => (/^\[.*\]$/.test(segment) ? 'sample-1' : segment));
  return `/${segments.join('/')}`;
}

describe('the path the proxy puts in ?redirect=', () => {
  beforeEach(() => resetRateLimitStore());

  it.each(['/admin', '/admin/users/abc-123', '/dashboard/billing', '/dashboard/'])(
    'comes back unchanged from resolveSafeRedirect for %s',
    async (path) => {
      const response = await proxy(new NextRequest(`http://localhost${path}`));

      const location = new URL(response.headers.get('location') ?? '');
      expect(location.pathname).toBe('/login');
      expect(resolveSafeRedirect(location.searchParams.get('redirect'))).toBe(path);
    }
  );
});

describe('route handlers', () => {
  const handlers = routeHandlerFiles(APP_DIR).map(urlPathOf);

  it('finds the route handlers this guard is about', () => {
    expect(handlers).toEqual(
      expect.arrayContaining(['/api/health', '/api/auth/clear-session', '/go/sample-1'])
    );
  });

  it.each(handlers)(
    'are never a sign-in target: %s (add a new handler path to NON_PAGE_PATHS in safe-redirect.ts)',
    (path) => {
      expect(resolveSafeRedirect(path)).toBe(DEFAULT_SIGN_IN_REDIRECT);
    }
  );
});
