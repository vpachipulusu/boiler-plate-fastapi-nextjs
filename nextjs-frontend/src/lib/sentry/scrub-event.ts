/**
 * Keeps one-use alert tokens, email addresses and cookies out of Sentry (FREEJ-24, FREEJ-31).
 *
 * No page puts an email address in its URL (the newsletter band is a plain link and `/alerts` ignores `?email=`),
 * but the privacy notice must stay true if one ever does, and the emailed confirm and unsubscribe links carry
 * `?token=...`. So page URLs, request query strings, transaction and span names, span attributes, breadcrumb
 * `to`/`from`/`url`, and the `referer` header are all scrubbed of:
 *
 * - a `token` parameter (exact name);
 * - any parameter whose name contains `email` or `e-mail` (`email`, `Email`, `newsletter_email`, `emailAddress`);
 * - any other parameter whose value is an email address (`?q=a%40b.com`: the public search box and the admin user
 *   search both take free text, and people type addresses into them).
 *
 * Each shape is covered in plain, percent-encoded (also nested in another URL, and encoded twice), JSON,
 * escaped-JSON and percent-encoded-JSON form, plus query strings held as an object or as name/value pairs. Next.js
 * also sends the route it is rendering in the `next-router-state-tree` header, which can embed the query as JSON
 * (`__PAGE__?{"token":"..."}`); that header is replaced whole.
 * `scrubEvent` is used as `beforeSend` and `beforeSendTransaction` in the client, server and edge configs.
 *
 * Pure: it never mutates its input, walks only plain objects and arrays to a bounded depth, and returns every
 * other value (dates, class instances) as it is. It never throws: an event it cannot walk safely is dropped
 * (`null`, which Sentry treats as "do not send"). It does not look for bare addresses outside a URL or query.
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

// `%` followed by any number of `25` is one percent sign encoded zero or more times (`%3D`, `%253D`, ...).
const PCT = '%(?:25)*';
/** A parameter name that is always filtered: `token`, or anything containing `email` / `e-mail`. */
const SENSITIVE_NAME = '(?:token|[\\w.[\\]-]*e-?mail[\\w.[\\]-]*)';
const ANY_NAME = '[\\w.[\\]-]+';
/** What can start a parameter: the start, `?`, `&`, `;`, or one of those percent-encoded (a URL inside a URL). */
const START = `(^|[?&;]|${PCT}(?:3F|26))`;
const EQUALS = `(?:=|${PCT}3D)`;
/** A value runs up to `&`, `#`, `;`, white space, a quote, or an encoded `&` or `#`. */
const VALUE = `(?:(?!${PCT}(?:26|23))[^&#;\\s"'])*`;
const ADDRESS_MARK = /@|%(?:25)*40/i;

const NAMED_PARAM = new RegExp(`${START}(${SENSITIVE_NAME}${EQUALS})${VALUE}`, 'gi');
const ANY_PARAM = new RegExp(`${START}(${ANY_NAME}${EQUALS})(${VALUE})`, 'gi');
const JSON_NAME = '(?:token|[\\w.-]*e-?mail[\\w.-]*)';

// Each pattern keeps its prefix and suffix and replaces only the value.
const JSON_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // {"email":"abc"}
  [new RegExp(`("${JSON_NAME}"\\s*:\\s*")[^"]*(")`, 'gi'), `$1${FILTERED}$2`],
  // {\"email\":\"abc\"} (JSON inside a JSON string)
  [
    new RegExp(`(\\\\"${JSON_NAME}\\\\"\\s*:\\s*\\\\")(?:(?!\\\\").)*(\\\\")`, 'gi'),
    `$1${FILTERED}$2`,
  ],
  // %22email%22%3A%22abc%22 (URL-encoded JSON, also encoded twice)
  [
    new RegExp(
      `(${PCT}22${JSON_NAME}${PCT}22${PCT}3A(?:${PCT}20)*${PCT}22)(?:(?!${PCT}22).)*(${PCT}22)`,
      'gi'
    ),
    `$1${FILTERED}$2`,
  ],
];

function isSensitiveName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === 'token' || /e-?mail/.test(lower);
}

function hasAddressMark(text: string): boolean {
  return ADDRESS_MARK.test(text);
}

function scrubString(value: string): string {
  const named = value.replace(NAMED_PARAM, `$1$2${FILTERED}`);
  const valued = named.replace(ANY_PARAM, (match, start: string, name: string, text: string) =>
    hasAddressMark(text) ? `${start}${name}${FILTERED}` : match
  );
  return JSON_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    valued
  );
}

/** A string known to be (part of) a query: anything still holding an address after scrubbing goes whole. */
function scrubQueryText(value: string): string {
  const text = scrubString(value);
  return hasAddressMark(text) ? FILTERED : text;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function scrubPair(name: string, value: unknown, depth: number): unknown[] {
  if (isSensitiveName(name)) return [name, FILTERED];
  const scrubbedValue =
    typeof value === 'string' ? scrubQueryText(value) : scrub(value, depth + 1, true);
  return [scrubQueryText(name), scrubbedValue];
}

function scrub(value: unknown, depth: number, inQuery: boolean): unknown {
  if (typeof value === 'string') return inQuery ? scrubQueryText(value) : scrubString(value);
  if (value === null || typeof value !== 'object' || depth >= MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    // A query string as [name, value] pairs.
    if (inQuery && value.length === 2 && typeof value[0] === 'string') {
      return scrubPair(value[0], value[1], depth);
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
    } else if (ROUTER_STATE_KEYS.has(lower) || (inQuery && isSensitiveName(key))) {
      result[key] = FILTERED;
    } else {
      result[scrubString(key)] = scrub(item, depth + 1, inQuery || QUERY_KEYS.has(key));
    }
  }
  return result;
}

/**
 * A copy of the event with tokens, email addresses in URLs and queries, the router state header and cookies
 * removed, or `null` (drop the event) if it could not be walked safely.
 */
export function scrubEvent<T extends object>(event: T): T | null {
  try {
    return scrub(event, 0, false) as T;
  } catch {
    return null;
  }
}
