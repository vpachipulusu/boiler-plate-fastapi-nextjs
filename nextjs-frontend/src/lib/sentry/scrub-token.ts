/**
 * Keeps one-use alert tokens, and cookies, out of Sentry. The emailed confirm and unsubscribe links carry
 * `?token=...`, so page URLs, request query strings, transaction and breadcrumb data of those pages would
 * otherwise hold it. Next.js also sends the route it is rendering in the `next-router-state-tree` header, and
 * that route can embed the query as JSON (`__PAGE__?{"token":"..."}`), URL-encoded.
 * `scrubEvent` is used as `beforeSend` and `beforeSendTransaction` in the client, server and edge configs.
 *
 * Pure: it never mutates its input, walks only plain objects and arrays to a bounded depth, and returns every
 * other value (dates, class instances) as it is.
 */

export const FILTERED = '[Filtered]';

const MAX_DEPTH = 12;
const QUERY_KEYS = new Set(['query_string', 'query', 'http.query', 'url.query']);
/** Header whose value carries the rendered route, including its query. Matched in lower case. */
const ROUTER_STATE_KEYS = new Set(['next-router-state-tree']);
/** Cookies are never sent. Matched in lower case. */
const COOKIE_KEYS = new Set(['cookie', 'cookies', 'set-cookie']);
/** Sentry's internal bookkeeping (removed before sending): kept by reference, never walked. */
const PASS_THROUGH_KEY = 'sdkProcessingMetadata';

// Each pattern keeps its prefix and suffix and replaces only the value.
const TOKEN_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // ?token=abc  &token=abc  ;token=abc  token=abc at the start of a query string
  [/(^|[?&;])(token=)[^&#;\s"']*/gi, `$1$2${FILTERED}`],
  // {"token":"abc"}
  [/("token"\s*:\s*")[^"]*(")/gi, `$1${FILTERED}$2`],
  // {\"token\":\"abc\"} (JSON inside a JSON string)
  [/(\\"token\\"\s*:\s*\\")(?:(?!\\").)*(\\")/gi, `$1${FILTERED}$2`],
  // %22token%22%3A%22abc%22 (URL-encoded JSON)
  [/(%22token%22%3A(?:%20)*%22)(?:(?!%22).)*(%22)/gi, `$1${FILTERED}$2`],
];

function scrubString(value: string): string {
  return TOKEN_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function scrub(value: unknown, depth: number, inQuery: boolean): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object' || depth >= MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    // A query string as [name, value] pairs.
    if (inQuery && value.length === 2 && typeof value[0] === 'string') {
      return value[0].toLowerCase() === 'token' ? [value[0], FILTERED] : value;
    }
    return value.map((item) => scrub(item, depth + 1, inQuery));
  }

  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (COOKIE_KEYS.has(lower)) continue;
    if (depth === 0 && key === PASS_THROUGH_KEY) {
      result[key] = item;
    } else if (ROUTER_STATE_KEYS.has(lower) || (inQuery && lower === 'token')) {
      result[key] = FILTERED;
    } else {
      result[key] = scrub(item, depth + 1, inQuery || QUERY_KEYS.has(key));
    }
  }
  return result;
}

/** A copy of the event with tokens, the router state header and cookies removed. */
export function scrubEvent<T extends object>(event: T): T {
  return scrub(event, 0, false) as T;
}
