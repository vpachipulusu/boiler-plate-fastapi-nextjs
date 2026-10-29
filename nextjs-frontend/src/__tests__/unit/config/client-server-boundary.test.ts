// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { CURRENCIES } from '@/config/currencies';

const SRC_DIR = path.resolve(__dirname, '../../..');
const CLIENT_DIRECTIVE = /^\s*['"]use client['"]/;
// The catalogue facade (`@/lib/catalogue`, which reads the API) and its server modules are server-only;
// client components may import `@/lib/catalogue/types`, `offer-url` and the other pure helpers.
const SERVER_ONLY_IMPORT =
  /from\s+['"]@\/(config\/subscriptions|lib\/db\/[^'"]+|lib\/api\/server|lib\/api\/catalogue|lib\/logger|lib\/stripe\/[^'"]+|lib\/firebase\/admin|lib\/catalogue|lib\/catalogue\/(?:api-source|api-mapper|revalidate|fixture-source))['"]/g;
// Backend settings are server-only. A client component reading one would compile to undefined at best.
const BACKEND_ENV_READ = /process\.env\.(BACKEND_\w+|CATALOGUE_SOURCE)/;
const PUBLIC_BACKEND_ENV = /NEXT_PUBLIC_(BACKEND|CATALOGUE)\w*/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return entry === '__tests__' ? [] : listSourceFiles(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

describe('Client/server import boundary', () => {
  describe('Given every client component in src', () => {
    it('should not import server-only modules', () => {
      const violations = listSourceFiles(SRC_DIR)
        .filter((file) => CLIENT_DIRECTIVE.test(readFileSync(file, 'utf8')))
        .flatMap((file) =>
          [...readFileSync(file, 'utf8').matchAll(SERVER_ONLY_IMPORT)].map(
            (match) => `${path.relative(SRC_DIR, file)} imports @/${match[1]}`
          )
        );

      expect(violations).toEqual([]);
    });
  });
});

describe('Server-only import pattern', () => {
  const flagged = (source: string) => [...source.matchAll(SERVER_ONLY_IMPORT)].length;

  it('should flag the catalogue facade and its server modules but not the pure helpers', () => {
    expect(flagged(`import { getOffers } from '@/lib/catalogue';`)).toBe(1);
    expect(flagged(`import { fetchOffers } from '@/lib/api/catalogue';`)).toBe(1);
    expect(flagged(`import { x } from '@/lib/catalogue/api-source';`)).toBe(1);
    expect(flagged(`import { x } from '@/lib/catalogue/revalidate';`)).toBe(1);
    expect(flagged(`import type { Offer } from '@/lib/catalogue/types';`)).toBe(0);
    expect(flagged(`import { x } from '@/lib/catalogue/offer-url';`)).toBe(0);
  });
});

describe('Backend settings stay out of the browser', () => {
  const files = listSourceFiles(SRC_DIR);
  const read = (file: string) => readFileSync(file, 'utf8');
  const relative = (file: string) => path.relative(SRC_DIR, file).split(path.sep).join('/');

  describe('Given every client component in src', () => {
    it('should not read BACKEND_* or CATALOGUE_SOURCE from the environment', () => {
      const violations = files
        .filter((file) => CLIENT_DIRECTIVE.test(read(file)))
        .filter((file) => BACKEND_ENV_READ.test(read(file)))
        .map(relative);

      expect(violations).toEqual([]);
    });
  });

  describe('Given every source file in src', () => {
    it('should never name a NEXT_PUBLIC_ backend or catalogue variable', () => {
      const violations = files.filter((file) => PUBLIC_BACKEND_ENV.test(read(file))).map(relative);

      expect(violations).toEqual([]);
    });

    it('should read CATALOGUE_SOURCE only in the catalogue source module', () => {
      const violations = files
        .filter((file) => /process\.env\.CATALOGUE_SOURCE/.test(read(file)))
        .map(relative);

      expect(violations).toEqual(['lib/catalogue/source.ts']);
    });
  });

  describe('Given the env templates', () => {
    it('should never set VERCEL, which would make a non-Vercel host trust x-vercel-forwarded-for', () => {
      const root = path.resolve(SRC_DIR, '..');
      const templates = readdirSync(root).filter((name) =>
        /^\.env(\..+)?\.(example|template|sample)$/.test(name)
      );

      expect(templates.length).toBeGreaterThan(0);
      for (const name of templates) {
        const uncommented = readFileSync(path.join(root, name), 'utf8')
          .split(/\r?\n/)
          .filter((line) => !line.trim().startsWith('#'));
        expect(
          uncommented.some((line) => /^\s*VERCEL\s*=/.test(line)),
          name
        ).toBe(false);
      }
    });

    it('should leave TRUSTED_CLIENT_IP_HEADER commented out and never public', () => {
      const example = readFileSync(path.resolve(SRC_DIR, '..', '.env.example'), 'utf8');

      expect(example).toMatch(/^# TRUSTED_CLIENT_IP_HEADER=/m);
      expect(example).not.toMatch(/NEXT_PUBLIC_TRUSTED/);
    });
  });

  describe('Given next.config.ts', () => {
    it('should not copy a backend setting into the client bundle through env', () => {
      const config = readFileSync(path.resolve(SRC_DIR, '..', 'next.config.ts'), 'utf8');

      expect(config).not.toMatch(/BACKEND_|CATALOGUE_SOURCE/);
    });
  });
});

describe('Currencies config', () => {
  describe('Given the client-safe CURRENCIES list', () => {
    it('should include USD with the dollar symbol', () => {
      expect(CURRENCIES.find((c) => c.code === 'USD')?.symbol).toBe('$');
    });

    it('should have unique currency codes', () => {
      const codes = CURRENCIES.map((c) => c.code);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });
});
