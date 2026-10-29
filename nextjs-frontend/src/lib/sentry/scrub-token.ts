/**
 * Keeps one-use alert tokens out of Sentry. The emailed confirm and unsubscribe links carry `?token=...`, so
 * page URLs, request query strings, transaction and breadcrumb data of those pages would otherwise hold it.
 * `scrubEvent` is used as `beforeSend` and `beforeSendTransaction` in the client, server and edge configs.
 *
 * It never mutates its input and walks events to a bounded depth.
 */

export const FILTERED = '[Filtered]';

const MAX_DEPTH = 12;
const QUERY_KEYS = new Set(['query_string', 'query', 'http.query', 'url.query']);
const TOKEN_IN_STRING = /(^|[?&;])(token=)[^&#;\s"']*/gi;

function scrubString(value: string): string {
  return value.replace(TOKEN_IN_STRING, `$1$2${FILTERED}`);
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

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (inQuery && key.toLowerCase() === 'token') {
      result[key] = FILTERED;
    } else {
      result[key] = scrub(item, depth + 1, inQuery || QUERY_KEYS.has(key));
    }
  }
  return result;
}

/** A copy of the event with every `token` query parameter replaced by `[Filtered]`. */
export function scrubEvent<T extends object>(event: T): T {
  return scrub(event, 0, false) as T;
}
