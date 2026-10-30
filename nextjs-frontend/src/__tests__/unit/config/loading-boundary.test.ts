// @vitest-environment node
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '../../../app');

function findLoadingFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return findLoadingFiles(full);
    return /^loading\.(tsx|ts|jsx|js)$/.test(entry) ? [full] : [];
  });
}

/**
 * A loading.tsx wraps its page in a Suspense boundary, and the dynamic public pages call notFound() after
 * awaiting the catalogue. With a boundary above them React streams the shell first, so the response is
 * already 200 when notFound() runs: every unknown offer or category becomes a soft 404. Measured on the
 * production build: with no loading.tsx above them /category/nope answers 404, with one it answers 200.
 * In-page <Suspense> boundaries (home sections, catalogue results) are fine; they sit below the
 * notFound() decision.
 */
describe('Loading boundaries and real 404s', () => {
  describe('Given the app directory', () => {
    it('should have no root loading.tsx', () => {
      expect(existsSync(path.join(APP_DIR, 'loading.tsx'))).toBe(false);
    });

    it('should have no loading file anywhere under the public routes', () => {
      expect(findLoadingFiles(path.join(APP_DIR, '(public)'))).toEqual([]);
    });

    it('should keep a loading file for each segment that relied on the root one', () => {
      for (const segment of ['dashboard', '(admin)/admin', '(auth)', 'pricing']) {
        expect(existsSync(path.join(APP_DIR, segment, 'loading.tsx')), segment).toBe(true);
      }
    });
  });
});
