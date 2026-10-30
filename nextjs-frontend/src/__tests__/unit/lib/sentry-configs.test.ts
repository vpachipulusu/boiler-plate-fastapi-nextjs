import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRouterTransitionStart: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

const CONFIGS: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ['client', () => import('../../../../src/instrumentation-client')],
  ['server', () => import('../../../../sentry.server.config')],
  ['edge', () => import('../../../../sentry.edge.config')],
];

const EVENT = {
  request: { url: 'https://x.test/alerts?email=victim%40example.com&token=abc' },
  transaction: 'GET /alerts?email=victim%40example.com',
};

describe('Sentry configs register the scrubber', () => {
  beforeEach(() => {
    vi.resetModules();
    sentry.init.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(CONFIGS)(
    '%s: beforeSend and beforeSendTransaction filter an address',
    async (_n, load) => {
      await load();

      expect(sentry.init).toHaveBeenCalledTimes(1);
      const options = sentry.init.mock.calls[0][0];
      for (const hook of [options.beforeSend, options.beforeSendTransaction]) {
        expect(typeof hook).toBe('function');
        const text = JSON.stringify(hook(EVENT));
        expect(text).toContain('[Filtered]');
        expect(text).not.toMatch(/victim|example\.com|abc/);
      }
    }
  );
});
