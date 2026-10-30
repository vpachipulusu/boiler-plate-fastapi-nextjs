import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';

/** 44px touch targets and one focus outline (the theme --ring token) defined in globals.css. */

const read = (rel: string) => readFileSync(resolve(__dirname, '../../..', rel), 'utf8');

describe('Button sizes', () => {
  it.each([
    ['default', 'h-11'],
    ['lg', 'h-12'],
    ['sm', 'h-10'],
  ] as const)('size %s uses %s', (size, height) => {
    expect(buttonVariants({ size })).toContain(height);
  });

  it('icon is 44x44', () => {
    expect(buttonVariants({ size: 'icon' })).toContain('h-11 w-11');
  });
});

describe('Single focus ring', () => {
  it('has no per-component ring classes on Button, Input or Badge', () => {
    const input = read('components/ui/input.tsx');
    for (const classes of [buttonVariants(), badgeVariants(), input]) {
      expect(classes).not.toMatch(/(focus|focus-visible):ring/);
    }
  });

  it('defines the focus-visible outline once with --ring', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/\*:focus-visible\s*\{\s*outline: 3px solid hsl\(var\(--ring\)\);/);
    expect(css).not.toContain('ring-ring/50');
  });

  it('defines the focus-proxy outline once, with the same 3px --ring outline and a --cta inverse variant', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(
      /label:has\(> \.sr-only:focus-visible\),\s*article:has\(a:focus-visible\)\s*\{\s*outline: 3px solid hsl\(var\(--ring\)\);\s*outline-offset: 2px;/
    );
    expect(css).toMatch(
      /\.on-inverse label:has\(> \.sr-only:focus-visible\),\s*\.on-inverse article:has\(a:focus-visible\)\s*\{\s*outline-color: hsl\(var\(--cta\)\);/
    );
    // A label that only contains a link (the alerts consent line) is not a proxy.
    expect(css).not.toMatch(/label:has\([^)]*a:focus-visible/);
  });

  it('restores the stretched link outline where :has() is unsupported', () => {
    const css = read('app/globals.css');

    expect(css).toMatch(
      /@supports not selector\(:has\(\*\)\)\s*\{[^}]*article a\[href\]:focus-visible\s*\{\s*outline: 3px solid hsl\(var\(--ring\)\);/
    );
  });

  it('stops the stretched link drawing a second ring in forced colors', () => {
    const css = read('app/globals.css');

    expect(css).toMatch(
      /@media \(forced-colors: active\)\s*\{\s*@supports selector\(:has\(\*\)\)\s*\{\s*article a\[href\]:focus-visible\s*\{\s*outline-style: none;/
    );
  });
});
