import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FREEJ-33: the single global `*:focus-visible` outline in globals.css is the only focus style. A Tailwind
 * `outline-none` compiles to `outline: 2px solid transparent` (it overrides the 3px global width) and a `ring`
 * adds a spread box-shadow, so neither may appear on tabbable elements.
 */

const SRC = resolve(__dirname, '../../..');

/** Utilities that replace or fake the global outline. */
const FORBIDDEN =
  /\boutline-none\b|(?:focus|focus-visible|has-\[[^\]]*\]):ring\b|(?:focus|focus-visible|has-\[[^\]]*\]):ring-|(?:^|[\s'"`:])ring-offset-\d/;

/** Files where `outline-none` is deliberate, each with the reason. Everything else must use the global outline. */
const ALLOWED: Record<string, string> = {
  // Skip-link target: `<main tabIndex={-1}>` takes programmatic focus only; a page-sized outline would be noise.
  'app/(admin)/admin/layout.tsx': 'main skip-link target',
  'app/(auth)/layout.tsx': 'main skip-link target',
  'app/(public)/layout.tsx': 'main skip-link target',
  'app/dashboard/layout.tsx': 'main skip-link target',
  // Route-change heading focus (tabIndex -1) so screen readers announce the error; not a control.
  'app/error.tsx': 'heading focus target',
  'app/global-error.tsx': 'heading focus target',
  // Radix roving-focus menu items: the highlight is the `focus:bg-accent` fill, an outline would collide with
  // the neighbouring rows inside the popup.
  'components/ui/dropdown-menu.tsx': 'Radix menu item highlight',
  'components/ui/select.tsx': 'Radix select item highlight',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('single global focus outline', () => {
  it('leaves outline-none and ring focus styles to the allow-listed non-tabbable targets', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join('/'))
      .filter((rel) => !(rel in ALLOWED))
      .filter((rel) => FORBIDDEN.test(readFileSync(join(SRC, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('keeps every allow-list entry honest (the file still uses outline-none)', () => {
    const stale = Object.keys(ALLOWED).filter(
      (rel) => !/\boutline-none\b/.test(readFileSync(join(SRC, rel), 'utf8'))
    );
    expect(stale).toEqual([]);
  });
});
