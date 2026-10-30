import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import rawPublicMode from '../../../../scripts/e2e-public-mode.cjs';
import e2eEnv from '../../../../scripts/e2e-env.cjs';

type Env = Record<string, string | undefined>;
const publicMode = rawPublicMode as unknown as {
  PUBLIC_SPECS: string[];
  PUBLIC_PROJECTS: string[];
  FIREBASE_PLACEHOLDERS: Record<string, string>;
  isPublicRun(args: string[], env?: Env): boolean;
  publicProjectArgs(): string[];
  publicRunEnv(env?: Env): Env;
};
const assertE2eFirebaseEnv = e2eEnv.assertE2eFirebaseEnv as (
  env: Env,
  options: { requireAdmin: boolean; cwd: string }
) => void;

const emptyDirs: string[] = [];
afterEach(() => {
  for (const dir of emptyDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('isPublicRun', () => {
  it('is public when every named spec is a public spec, by name or by path', () => {
    expect(publicMode.isPublicRun(['outbound', 'alerts-lifecycle'], {})).toBe(true);
    expect(publicMode.isPublicRun(['src/__tests__/e2e/outbound.spec.ts'], {})).toBe(true);
    expect(publicMode.isPublicRun(['src\\__tests__\\e2e\\alerts-lifecycle.spec.ts'], {})).toBe(
      true
    );
    expect(publicMode.isPublicRun(['outbound', '--workers=2', '--grep=ended'], {})).toBe(true);
  });

  it('is not public when any spec is not public, or none is named', () => {
    expect(publicMode.isPublicRun([], {})).toBe(false);
    expect(publicMode.isPublicRun(['--workers=2'], {})).toBe(false);
    expect(publicMode.isPublicRun(['outbound', 'dashboard'], {})).toBe(false);
    expect(publicMode.isPublicRun(['go-redirect'], {})).toBe(false);
    expect(publicMode.isPublicRun(['not-outbound'], {})).toBe(false);
  });

  it('treats a bare option value as a spec name, so the run is not public', () => {
    expect(publicMode.isPublicRun(['outbound', '--workers', '2'], {})).toBe(false);
  });

  it('lets E2E_PUBLIC force the mode either way', () => {
    expect(publicMode.isPublicRun(['dashboard'], { E2E_PUBLIC: '1' })).toBe(true);
    expect(publicMode.isPublicRun([], { E2E_PUBLIC: '1' })).toBe(true);
    expect(publicMode.isPublicRun(['outbound'], { E2E_PUBLIC: '0' })).toBe(false);
  });
});

describe('publicProjectArgs', () => {
  it('selects exactly the two money-path projects, never setup', () => {
    expect(publicMode.publicProjectArgs()).toEqual([
      '--project=money-desktop',
      '--project=money-mobile',
    ]);
  });
});

describe('publicRunEnv', () => {
  it('forces placeholder Firebase values over real ones and keeps other variables', () => {
    const result = publicMode.publicRunEnv({
      NEXT_PUBLIC_FIREBASE_API_KEY: 'a-real-looking-key',
      FIREBASE_ADMIN_PRIVATE_KEY: 'a-real-looking-private-key',
      BACKEND_INTERNAL_KEY: 'kept',
    });

    expect(result.NEXT_PUBLIC_FIREBASE_API_KEY).toBe('e2e-public-placeholder');
    expect(result.FIREBASE_ADMIN_PRIVATE_KEY).toBe('e2e-public-placeholder');
    expect(result.BACKEND_INTERNAL_KEY).toBe('kept');
  });

  it('turns on the live catalogue and the alerts form and marks the run public', () => {
    const result = publicMode.publicRunEnv({});

    expect(result.E2E_LIVE_CATALOGUE).toBe('1');
    expect(result.ALERTS_FORM_LIVE).toBe('true');
    expect(result.E2E_PUBLIC).toBe('1');
  });

  it('does not change the env it was given', () => {
    const input: Env = { BACKEND_INTERNAL_KEY: 'kept' };

    publicMode.publicRunEnv(input);

    expect(input).toEqual({ BACKEND_INTERNAL_KEY: 'kept' });
  });

  it('gives a Firebase config the e2e checks accept, with the live catalogue in the server env', () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'e2e-public-'));
    emptyDirs.push(cwd);
    const env = publicMode.publicRunEnv({});

    expect(() => assertE2eFirebaseEnv(env, { requireAdmin: true, cwd })).not.toThrow();
    const serverEnv = (e2eEnv.toNextProcessEnv as (env: Env) => Env)(env);
    expect(serverEnv.CATALOGUE_SOURCE).toBe('api');
  });
});

describe('the public spec list', () => {
  it('matches the specs the local Playwright config routes to the money-path projects', () => {
    expect(publicMode.PUBLIC_SPECS).toEqual(['outbound', 'alerts-lifecycle']);
    expect(publicMode.PUBLIC_PROJECTS).toEqual(['money-desktop', 'money-mobile']);
  });
});
