import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FREEJ-33: the single global `*:focus-visible` outline in globals.css is the only focus style. A Tailwind
 * `outline-none` compiles to `outline: 2px solid transparent` (it overrides the 3px global width) and a `ring`
 * adds a spread box-shadow, so neither may appear on tabbable elements.
 */

const SRC = resolve(__dirname, '../../..');

/** Ways of switching the outline off or hiding it: utilities, arbitrary properties and raw CSS. */
const OUTLINE_OFF = String.raw`outline-(?:none|0|transparent|hidden)(?![\w-])|\[outline(?:-style|-width)?:\s*(?:none|0)|(?<![\w-])outline(?:-style)?:\s*(?:none|0)(?![\w.])`;
/** A ring (a spread box-shadow) used as a focus or state indicator, under any focus-like variant. */
const RING_VARIANT = String.raw`(?:focus|focus-visible|focus-within|(?:group|peer)-focus(?:-visible|-within)?|(?:has|data|aria)-\[[^\]]*\]|(?:data|aria)-[\w-]+):ring(?![\w])`;
/** A ring offset is only ever used with a ring. */
const RING_OFFSET = String.raw`(?<![\w-])ring-offset-\d`;

/** Utilities that replace or fake the global outline. */
const FORBIDDEN = new RegExp(`${OUTLINE_OFF}|${RING_VARIANT}|${RING_OFFSET}`);

/** Files where the outline is switched off on purpose, each with the reason. Everything else uses the global outline. */
const ALLOWED: Record<string, string> = {
  // Skip-link target: `<main tabIndex={-1}>` takes programmatic focus only; a page-sized outline would be noise.
  'app/(admin)/admin/layout.tsx': 'main skip-link target',
  'app/(auth)/layout.tsx': 'main skip-link target',
  'app/(public)/layout.tsx': 'main skip-link target',
  'app/dashboard/layout.tsx': 'main skip-link target',
  // Route-change heading focus (tabIndex -1) so screen readers announce the error; not a control.
  'app/error.tsx': 'heading focus target',
  'app/global-error.tsx': 'heading focus target',
  // Stretched link: its ::after covers the card, so the title link draws none and the card draws the one outline
  // (the focus-proxy rule in globals.css).
  'components/catalogue/offer-card.tsx': 'stretched link: the card carries the outline',
  // Forced-colors only: the stretched link's transparent outline would show as a second ring inside the card's.
  'app/globals.css': 'forced-colors: the card carries the outline, not its stretched link',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('forbidden focus pattern', () => {
  it.each([
    'focus-visible:outline-none',
    'outline-none',
    'outline-0',
    'focus-visible:outline-transparent',
    'outline-hidden',
    '[outline:none]',
    '[outline:0]',
    '[outline:0px]',
    'outline: none;',
    'outline:0;',
    'outline-style: none',
    'focus:ring',
    'focus-visible:ring-2',
    'focus-within:ring-2',
    'group-focus-visible:ring-ring',
    'peer-focus-visible:ring-2',
    'has-[:focus-visible]:ring-2',
    'data-[state=open]:ring-2',
    'aria-[expanded=true]:ring-1',
    'aria-expanded:ring-2',
    'ring-offset-2',
    'focus-visible:ring-offset-2',
  ])('matches %s', (classes) => {
    expect(FORBIDDEN.test(classes)).toBe(true);
  });

  it.each([
    'ring-0',
    'ring-2 ring-transparent hover:ring-ring',
    'outline-offset-0',
    'outline-offset-2',
    'outline-2',
    'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring',
    'outline: 3px solid hsl(var(--ring));',
    'hover:ring-2',
  ])('does not match %s', (classes) => {
    expect(FORBIDDEN.test(classes)).toBe(false);
  });
});

/** FREEJ-35: the focus-proxy outline (sr-only control inside a label, stretched link inside an article) is one rule in globals.css. */
describe('focus-proxy outline has a single source', () => {
  const PROXY_UTILITY = /has-\[[^\]]*focus-visible[^\]]*\]:/;

  it('is not re-drawn with has-[...] utilities in any component', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join('/'))
      .filter((rel) => PROXY_UTILITY.test(readFileSync(join(SRC, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('single global focus outline', () => {
  it('leaves outline-off and ring focus styles to the allow-listed non-tabbable targets', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join('/'))
      .filter((rel) => !(rel in ALLOWED))
      .filter((rel) => FORBIDDEN.test(readFileSync(join(SRC, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('keeps every allow-list entry honest (the file still switches the outline off)', () => {
    const stale = Object.keys(ALLOWED).filter(
      (rel) => !new RegExp(OUTLINE_OFF).test(readFileSync(join(SRC, rel), 'utf8'))
    );
    expect(stale).toEqual([]);
  });
});
