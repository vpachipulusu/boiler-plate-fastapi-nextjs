import { execFileSync } from 'node:child_process';

/**
 * The optional database seam: read-only SQL against the TEST database the backend under test uses, through a `psql`
 * command the developer names in E2E_PSQL. The browser and the Next.js server never read the database, so a click row
 * or a subscriber's status can only be checked from here. Without E2E_PSQL the assertions that need it are skipped, never
 * faked.
 *
 * E2E_PSQL is the command up to and including the connection, split on spaces (no quoting). Examples:
 *   docker exec freejoy-test-pg psql -U postgres -d freejoy_dev3_test
 *   psql postgresql://postgres:<password>@127.0.0.1:5433/freejoy_dev3_test
 * `-X -tA -F | -c <sql>` is appended here, and the session is made read-only. A command whose connection does not name a
 * database ending in `_test` is refused.
 */

export const DB_SEAM = process.env.E2E_PSQL;

const FIELD_SEPARATOR = '|';
const MAX_SQL_VALUE_LENGTH = 320;
const SQL_VALUE = /^[A-Za-z0-9@._+-]+$/;

const TEST_DATABASE_SUFFIX = '_test';
const READ_ONLY_OPTION = '-c default_transaction_read_only=on';

/** Database names a postgres:// URL points at: its path and an explicit `dbname` parameter. */
function urlDatabases(word: string): string[] {
  try {
    const url = new URL(word);
    const names = [decodeURIComponent(url.pathname.replace(/^\//, ''))];
    const explicit = url.searchParams.get('dbname');
    return explicit === null ? names : [...names, explicit];
  } catch {
    return [''];
  }
}

/** Every database a psql command line names: `-d x`, `-dx`, `--dbname x`, `--dbname=x`, `dbname=x`, or a URL. */
function databaseNames(words: string[]): string[] {
  const names: string[] = [];
  words.forEach((word, index) => {
    if (word === '-d' || word === '--dbname') names.push(words[index + 1] ?? '');
    else if (word.startsWith('--dbname=')) names.push(word.slice('--dbname='.length));
    else if (/^-d[^-]/.test(word)) names.push(word.slice(2));
    else if (word.startsWith('dbname=')) names.push(word.slice('dbname='.length));
    else if (/^postgres(ql)?:\/\//i.test(word)) names.push(...urlDatabases(word));
  });
  return names;
}

/**
 * The command words of an E2E_PSQL value: [executable, ...arguments]. Throws on an empty value, and unless the
 * connection names a database ending in `_test` (and no other): the seam must never be pointed at a dev or real database.
 */
export function parseSeamCommand(raw: string): string[] {
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) throw new Error('E2E_PSQL is empty');
  const names = databaseNames(words);
  if (names.length === 0 || !names.every((name) => name.endsWith(TEST_DATABASE_SUFFIX))) {
    throw new Error(
      `E2E_PSQL must name a database ending in ${TEST_DATABASE_SUFFIX} (-d <name>, --dbname=<name> or a postgres:// URL), and no other`
    );
  }
  return words;
}

/**
 * The same command made read-only for the session. Locally PGOPTIONS does it; `docker exec` does not pass the caller's
 * environment into the container, so the option is handed over with `-e`.
 */
export function readOnlyCommand(words: string[]): string[] {
  if (/^docker(\.exe)?$/i.test(words[0]) && words[1] === 'exec') {
    return [words[0], 'exec', '-e', `PGOPTIONS=${READ_ONLY_OPTION}`, ...words.slice(2)];
  }
  return words;
}

/**
 * A single-quoted SQL string literal. The values the specs pass are ids, slugs and addresses, so anything outside
 * letters, digits and `@ . _ + -` is refused rather than escaped.
 */
export function sqlLiteral(value: string): string {
  if (value.length === 0 || value.length > MAX_SQL_VALUE_LENGTH || !SQL_VALUE.test(value)) {
    throw new Error('refusing to put that value into SQL');
  }
  return `'${value}'`;
}

/** Rows of `psql -tA -F |` output as arrays of fields. */
export function parseRows(output: string): string[][] {
  return output
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line !== '')
    .map((line) => line.split(FIELD_SEPARATOR));
}

/** Runs one query through the seam in a read-only session. Throws when the seam is off or the command fails. */
export function queryRows(sql: string, seam: string | undefined = DB_SEAM): string[][] {
  if (!seam) throw new Error('E2E_PSQL is not set');
  const [command, ...args] = readOnlyCommand(parseSeamCommand(seam));
  const pgOptions = [process.env.PGOPTIONS, READ_ONLY_OPTION].filter(Boolean).join(' ');
  const output = execFileSync(command, [...args, '-X', '-tA', '-F', FIELD_SEPARATOR, '-c', sql], {
    encoding: 'utf-8',
    timeout: 15_000,
    env: { ...process.env, PGOPTIONS: pgOptions },
  });
  return parseRows(output);
}

/** `select count(*)` for `from_where` (everything after `select count(*) `). */
export function countRows(fromWhere: string, seam: string | undefined = DB_SEAM): number {
  const [row] = queryRows(`select count(*) ${fromWhere}`, seam);
  return Number(row?.[0] ?? 'NaN');
}

/** Clicks recorded for an offer, optionally narrowed to one coarse device class and referrer host. */
export function clickCount(
  offerId: string,
  filter: { userAgentClass?: string; referrerHost?: string } = {}
): number {
  const conditions = [`offer_id = ${sqlLiteral(offerId)}`];
  if (filter.userAgentClass) {
    conditions.push(`user_agent_class = ${sqlLiteral(filter.userAgentClass)}`);
  }
  if (filter.referrerHost) conditions.push(`referrer_host = ${sqlLiteral(filter.referrerHost)}`);
  return countRows(`from click_events where ${conditions.join(' and ')}`);
}

/** The offer's id (the key of `/go/<id>`), or null when there is no such slug. */
export function offerIdForSlug(slug: string): string | null {
  const [row] = queryRows(`select id from offers where slug = ${sqlLiteral(slug)}`);
  return row?.[0] ?? null;
}

/** A subscriber's status (PENDING, CONFIRMED, UNSUBSCRIBED), or null when the address has no row. */
export function subscriberStatus(email: string): string | null {
  const [row] = queryRows(
    `select status from email_subscribers where email = ${sqlLiteral(email.toLowerCase())}`
  );
  return row?.[0] ?? null;
}
