import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countRows,
  parseRows,
  parseSeamCommand,
  queryRows,
  sqlLiteral,
} from '../../e2e/helpers/db-seam';

type SeamModule = typeof import('../../e2e/helpers/db-seam');

/** The module reads E2E_PSQL when it is imported, so load a fresh copy after the env is set. */
async function loadSeam(): Promise<SeamModule> {
  vi.resetModules();
  return import('../../e2e/helpers/db-seam');
}

const FAKE_PSQL = path.resolve(__dirname, 'fake-psql.mjs');
const SEAM = `node ${FAKE_PSQL}`;

let logDir: string;
let logFile: string;

beforeEach(() => {
  logDir = mkdtempSync(path.join(tmpdir(), 'db-seam-'));
  logFile = path.join(logDir, 'calls.jsonl');
  process.env.FAKE_PSQL_LOG = logFile;
  process.env.E2E_PSQL = SEAM;
});

afterEach(() => {
  delete process.env.FAKE_PSQL_LOG;
  delete process.env.FAKE_PSQL_OUT;
  delete process.env.FAKE_PSQL_FAIL;
  delete process.env.E2E_PSQL;
  rmSync(logDir, { recursive: true, force: true });
});

const loggedSql = () =>
  readFileSync(logFile, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => (JSON.parse(line) as { sql: string }).sql);

describe('parseSeamCommand', () => {
  it('splits on any run of whitespace', () => {
    expect(parseSeamCommand('docker  exec box\tpsql -U postgres')).toEqual([
      'docker',
      'exec',
      'box',
      'psql',
      '-U',
      'postgres',
    ]);
  });

  it('refuses an empty command', () => {
    expect(() => parseSeamCommand('   ')).toThrow('E2E_PSQL is empty');
  });
});

describe('sqlLiteral', () => {
  it('quotes ids, slugs and addresses', () => {
    expect(sqlLiteral('mi7yp4huewx1vvr2m3qoxapr')).toBe("'mi7yp4huewx1vvr2m3qoxapr'");
    expect(sqlLiteral('e2e-1-ab+tag@example.com')).toBe("'e2e-1-ab+tag@example.com'");
  });

  it.each(["x'; drop table offers; --", 'a b', 'a"b', 'a\b', 'a;b', '', 'é'])(
    'refuses %j',
    (value) => {
      expect(() => sqlLiteral(value)).toThrow('refusing to put that value into SQL');
    }
  );

  it('refuses a value over the length limit', () => {
    expect(() => sqlLiteral('a'.repeat(321))).toThrow('refusing');
  });
});

describe('parseRows', () => {
  it('returns one array of fields per non-empty line, tolerating CRLF', () => {
    expect(parseRows('a|b\r\nc|d\n\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns no rows for empty output', () => {
    expect(parseRows('')).toEqual([]);
  });
});

describe('queryRows', () => {
  it('appends the psql flags and the SQL to the seam command', () => {
    process.env.FAKE_PSQL_OUT = 'x|y';

    expect(queryRows('select 1', SEAM)).toEqual([['x', 'y']]);

    const [call] = readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
    expect((JSON.parse(call) as { args: string[] }).args).toEqual([
      '-X',
      '-tA',
      '-F',
      '|',
      '-c',
      'select 1',
    ]);
  });

  it('throws when the seam is off', () => {
    expect(() => queryRows('select 1', undefined)).toThrow('E2E_PSQL is not set');
  });

  it('throws when the command fails', () => {
    process.env.FAKE_PSQL_FAIL = '1';

    expect(() => queryRows('select 1', SEAM)).toThrow();
  });
});

describe('countRows', () => {
  it('counts rows', () => {
    process.env.FAKE_PSQL_OUT = '4';

    expect(countRows('from click_events', SEAM)).toBe(4);
    expect(loggedSql()).toEqual(['select count(*) from click_events']);
  });

  it('returns NaN, not zero, when the count cannot be read', () => {
    process.env.FAKE_PSQL_OUT = '';

    expect(countRows('from click_events', SEAM)).toBeNaN();
  });
});

describe('the query helpers (seam from E2E_PSQL)', () => {
  it('exposes the seam only when E2E_PSQL is set', async () => {
    expect((await loadSeam()).DB_SEAM).toBe(SEAM);
    delete process.env.E2E_PSQL;
    expect((await loadSeam()).DB_SEAM).toBeUndefined();
  });

  it('counts the clicks of one offer, optionally by device class and referrer host', async () => {
    process.env.FAKE_PSQL_OUT = '2';
    const { clickCount } = await loadSeam();

    expect(clickCount('offer_1')).toBe(2);
    expect(clickCount('offer_1', { userAgentClass: 'MOBILE', referrerHost: 'localhost' })).toBe(2);

    expect(loggedSql()).toEqual([
      "select count(*) from click_events where offer_id = 'offer_1'",
      "select count(*) from click_events where offer_id = 'offer_1' and user_agent_class = 'MOBILE' and referrer_host = 'localhost'",
    ]);
  });

  it('refuses an offer id that is not an id, before any query runs', async () => {
    const { clickCount } = await loadSeam();

    expect(() => clickCount("x' or '1'='1")).toThrow('refusing');
    expect(() => readFileSync(logFile)).toThrow();
  });

  it('looks an offer up by slug, and returns null when there is none', async () => {
    process.env.FAKE_PSQL_OUT = 'abc123';
    const { offerIdForSlug } = await loadSeam();
    expect(offerIdForSlug('laundry-sheets-sample')).toBe('abc123');

    process.env.FAKE_PSQL_OUT = '';
    expect(offerIdForSlug('no-such-offer')).toBeNull();
    expect(loggedSql()[0]).toBe("select id from offers where slug = 'laundry-sheets-sample'");
  });

  it('reads a subscriber status by lower-cased address, and null for an unknown address', async () => {
    process.env.FAKE_PSQL_OUT = 'UNSUBSCRIBED';
    const { subscriberStatus } = await loadSeam();
    expect(subscriberStatus('Person@Example.com')).toBe('UNSUBSCRIBED');

    process.env.FAKE_PSQL_OUT = '';
    expect(subscriberStatus('nobody@example.com')).toBeNull();
    expect(loggedSql()[0]).toBe(
      "select status from email_subscribers where email = 'person@example.com'"
    );
  });
});
