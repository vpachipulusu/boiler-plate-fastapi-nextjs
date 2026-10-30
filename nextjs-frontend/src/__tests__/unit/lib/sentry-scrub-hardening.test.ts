import { describe, expect, it } from 'vitest';
import { FILTERED, scrubEvent } from '@/lib/sentry/scrub-event';

const ADDRESS = 'victim@example.com';
const ENCODED = 'victim%40example.com';

function expectNoLeak(value: unknown) {
  const text = JSON.stringify(value);
  for (const leak of ['victim', 'example.com', '%40', '%2540', 'abc']) {
    expect(text).not.toContain(leak);
  }
}

function elapsed(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe('scrubEvent: cycles, shared references and depth', () => {
  it('finishes fast on an object with six self-references and leaks nothing', () => {
    const node: Record<string, unknown> = { url: `https://x.test/a?email=${ENCODED}` };
    for (let i = 0; i < 6; i++) node[`self${i}`] = node;
    let result: unknown;

    const ms = elapsed(() => {
      result = scrubEvent({ extra: node });
    });

    expect(ms).toBeLessThan(100);
    expectNoLeak(result);
    expect(JSON.stringify(result)).toContain('[Circular]');
  });

  it('finishes fast on mutually referencing arrays and objects', () => {
    const a: Record<string, unknown> = { to: `/a?email=${ENCODED}` };
    const b: unknown[] = [a, a, a];
    a.list = b;
    a.again = b;

    const ms = elapsed(() => {
      expectNoLeak(scrubEvent({ breadcrumbs: b }));
    });

    expect(ms).toBeLessThan(100);
  });

  it('finishes fast when one child is shared ten times, and again down a diamond chain', () => {
    const shared = { url: `https://x.test/a?email=${ENCODED}` };
    const wide = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, shared]));
    let level: Record<string, unknown> = shared;
    for (let i = 0; i < 11; i++) level = { left: level, right: level };

    const ms = elapsed(() => {
      expectNoLeak(scrubEvent({ extra: wide }));
      expectNoLeak(scrubEvent({ extra: level }));
    });

    expect(ms).toBeLessThan(200);
  });

  it('drops the event rather than walk an unreasonable number of nodes', () => {
    const huge = { list: Array.from({ length: 150_000 }, (_, i) => ({ i })) };

    expect(scrubEvent(huge)).toBeNull();
  });

  it('keeps ordinary repeated values apart from the cycle marker', () => {
    const shared = { n: 1 };

    expect(scrubEvent({ a: shared, b: shared })).toEqual({ a: { n: 1 }, b: { n: 1 } });
  });

  it('filters an object nested past the depth limit instead of passing it through', () => {
    const url = `https://x.test/a?email=${ENCODED}`;
    let nested: Record<string, unknown> = { url };
    for (let i = 0; i < 13; i++) nested = { next: nested };

    const scrubbed = scrubEvent({ extra: nested });

    expectNoLeak(scrubbed);
    expect(JSON.stringify(scrubbed)).toContain(FILTERED);
  });

  it('filters an array nested past the depth limit', () => {
    let nested: unknown = [`/a?email=${ENCODED}`];
    for (let i = 0; i < 13; i++) nested = [nested];

    expectNoLeak(scrubEvent({ extra: nested }));
  });
});

describe('scrubEvent: gaps in how an address can be written into a URL', () => {
  const URLS = [
    `https://x.test/alerts#email=${ENCODED}&token=abc`,
    `https://x.test/alerts?x=1#/page?email=${ADDRESS}`,
    `https://x.test/alerts?EMAIL%5B%5D=${ENCODED}&token=abc`,
    `https://x.test/alerts?user%5Bemail%5D=${ENCODED}&token=abc`,
    `https://x.test/alerts?Email%5b%5d=${ENCODED}`,
    `https://${ENCODED}@x.test/alerts?token=abc`,
    `https://${ADDRESS}@x.test/alerts`,
    `https://api.test/v3/contacts/${ENCODED}`,
    `https://api.test/v3/contacts/${ADDRESS}`,
    `https://api.test/v3/contacts/victim%2540example.com`,
    `https://x.test/alerts?${ENCODED}`,
    `https://x.test/alerts?q+${ENCODED}`,
    `https://x.test/alerts?${ADDRESS}&token=abc`,
    `https://x.test/alerts?x=1&${ENCODED}`,
    `https://x.test/alerts?q=${'a'.repeat(300)}.${ADDRESS}`,
  ];

  it.each(URLS)('removes the address from %s everywhere it is reported', (url) => {
    const scrubbed = scrubEvent({
      request: { url, headers: { referer: url } },
      transaction: `GET ${url}`,
      breadcrumbs: [
        { category: 'navigation', data: { from: url, to: url } },
        { category: 'fetch', data: { url } },
      ],
    });

    const text = JSON.stringify(scrubbed);
    expect(text).not.toContain('victim');
    expect(text).not.toContain('example.com');
    expect(text).not.toContain('abc"');
  });

  it('replaces a bare address in any string, plain or percent-encoded', () => {
    const scrubbed = scrubEvent({
      message: `Failed for ${ADDRESS} and ${ENCODED} and VICTIM@EXAMPLE.CO.UK.`,
      user: { email: ADDRESS },
    });

    expectNoLeak(scrubbed);
    expect(scrubbed?.message).toBe(`Failed for ${FILTERED} and ${FILTERED} and ${FILTERED}.`);
  });

  it('keeps stack frames, decorators, scoped packages and host-only text unchanged', () => {
    const event = {
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                { filename: 'node_modules/@sentry/core/build/index.js', lineno: 3 },
                { filename: 'app:///node_modules/@radix-ui/react-dialog/dist/index.mjs' },
                { filename: 'node_modules/.pnpm/@sentry+core@8.1.0/node_modules/x.js' },
                { context_line: '  @Injectable()', pre_context: ['@Component({'] },
              ],
            },
          },
        ],
      },
      message: 'ssh user@host failed; see npm@10.9.1 and @scope/pkg',
    };

    expect(scrubEvent(event)).toEqual(event);
  });

  it('is fast on long runs of address-like characters', () => {
    const runs = [
      'a'.repeat(200_000),
      `${'a'.repeat(200_000)}@`,
      '%40'.repeat(100_000),
      `${'a@'.repeat(100_000)}b`,
      `x@${'a.'.repeat(100_000)}`,
    ];

    const ms = elapsed(() => {
      for (const run of runs) scrubEvent({ message: run, extra: { url: `/a?${run}` } });
    });

    expect(ms).toBeLessThan(3000);
  });
});

describe('scrubEvent: parameter-name and JSON-name patterns stay linear', () => {
  const REPEATED: ReadonlyArray<readonly [string, (n: number) => string]> = [
    ['a query of repeated email', (n) => `?${'email'.repeat(n)}`],
    ['repeated email', (n) => 'email'.repeat(n)],
    ['a quote then repeated email', (n) => `"${'email'.repeat(n)}`],
    ['an escaped quote then repeated email', (n) => `\\"${'email'.repeat(n)}`],
    ['repeated percent-encoded email', (n) => '%22email%22'.repeat(n)],
  ];
  const BOUNDS = [
    ['20 000 repeats', 20_000, 50],
    ['about 1 MB', 200_000, 1500],
  ] as const;

  for (const [name, build] of REPEATED) {
    for (const [size, repeats, limit] of BOUNDS) {
      it(`${name}, ${size}, takes under ${limit} ms`, () => {
        const text = build(repeats);

        const ms = elapsed(() => {
          scrubEvent({ message: text, request: { url: text } });
        });

        expect(ms).toBeLessThan(limit);
      });
    }
  }
});

describe('scrubEvent: addresses with letters outside ASCII', () => {
  it.each([
    'jösé@example.com',
    'josé@example.com',
    'victim@bücher.example',
    'victim@exämple.com',
    'victim%40ex%C3%A4mple.com',
    'victim@exam%70le.com',
    'ünïcode@exämple.co.uk',
  ])('replaces %s wherever it appears', (address) => {
    const url = `https://x.test/contacts/${address}?q=${address}`;
    const scrubbed = scrubEvent({
      message: `for ${address}.`,
      request: { url },
      breadcrumbs: [{ data: { to: url, from: `/a/${address}` } }],
    });

    const text = JSON.stringify(scrubbed);
    expect(text).not.toMatch(/jös|josé|victim|ünï|bücher|exäm|exam%70|%C3/i);
    expect(scrubbed?.message).toBe(`for ${FILTERED}.`);
  });

  it('is fast on a long run of non-ASCII labels', () => {
    const ms = elapsed(() => {
      scrubEvent({
        message: `x@${'ä.'.repeat(100_000)}`,
        extra: { u: `/a?${'ä@'.repeat(50_000)}` },
      });
    });

    expect(ms).toBeLessThan(200);
  });
});
