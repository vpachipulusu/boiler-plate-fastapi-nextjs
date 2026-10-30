/**
 * Stand-in for `psql` in the db-seam unit tests: appends the SQL (the argument after -c) to FAKE_PSQL_LOG and prints
 * FAKE_PSQL_OUT, or the SQL itself when that is unset. Exits 3 when FAKE_PSQL_FAIL is set.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const sql = args[args.indexOf('-c') + 1];
if (process.env.FAKE_PSQL_LOG) {
  fs.appendFileSync(
    process.env.FAKE_PSQL_LOG,
    `${JSON.stringify({ args, sql, pgoptions: process.env.PGOPTIONS ?? null })}\n`
  );
}
if (process.env.FAKE_PSQL_FAIL) {
  console.error('psql: error');
  process.exit(3);
}
process.stdout.write(`${process.env.FAKE_PSQL_OUT ?? sql}\n`);
