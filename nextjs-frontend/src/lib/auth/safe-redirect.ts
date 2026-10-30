/**
 * Where a visitor goes after signing in. `src/proxy.ts` sends an unauthenticated visitor from a protected page to
 * `/login?redirect=<pathname>` (the path only, never the query string), so the sign-in page can send them back.
 * That value comes from the address bar, so it is untrusted: this is the one place that turns it into a same-origin
 * path or the default. It is pure (no I/O), so the server page, the sign-in hook and the tests all share it.
 */

/** Where every sign-in lands when there is no safe `redirect` value. */
export const DEFAULT_SIGN_IN_REDIRECT = '/dashboard';

/** The longest `redirect` value accepted, in characters. Real paths are far shorter. */
export const MAX_REDIRECT_LENGTH = 512;

/** Only used to parse the value; the result must stay on this origin. */
const PARSE_BASE = 'http://localhost';

/** Pages of the `(auth)` group: sending someone back to one of them would loop or confuse. */
const AUTH_PATHS = ['/login', '/signup', '/reset-password', '/verify-email'];

/** Route handlers and framework internals: they are not pages, and some (clear-session) change the session. */
const NON_PAGE_PATHS = ['/api', '/go', '/alerts/unsubscribe/one-click', '/_next'];

const BLOCKED_PATHS = [...AUTH_PATHS, ...NON_PAGE_PATHS];

const BACKSLASH = 0x5c;

/** Control characters (C0, DEL, C1), line and paragraph separators, zero-width and bidirectional formatting marks. */
function isForbiddenCodePoint(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    code === BACKSLASH ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/** A single "/" followed by something that is not a slash or a backslash (or just "/"): never protocol-relative. */
function hasPathShape(value: string): boolean {
  if (value[0] !== '/') return false;
  return value.length === 1 || (value[1] !== '/' && value.charCodeAt(1) !== BACKSLASH);
}

/** True for any form that could turn into another origin, a scheme, or a different request when decoded. */
function hasForbiddenForm(value: string): boolean {
  if (!hasPathShape(value) || value.includes('://')) return true;
  for (const char of value) {
    if (isForbiddenCodePoint(char.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** The value, then decoded once and twice. Null when a decode fails: a malformed escape is never trusted. */
function decodedForms(value: string): string[] | null {
  const once = decodeOnce(value);
  const twice = once === null ? null : decodeOnce(once);
  return once === null || twice === null ? null : [value, once, twice];
}

/** Resolves "." and ".." segments, so "/x/../login" is seen as "/login". */
function resolveDotSegments(path: string): string {
  const resolved: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '..') resolved.pop();
    else if (segment !== '.' && segment !== '') resolved.push(segment);
  }
  return `/${resolved.join('/')}`;
}

function isBlockedPath(pathname: string): boolean {
  const forms = decodedForms(pathname);
  if (forms === null) return true;
  return forms.some((form) => {
    const path = resolveDotSegments(form).toLowerCase();
    return BLOCKED_PATHS.some((blocked) => path === blocked || path.startsWith(`${blocked}/`));
  });
}

function parseSafeRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_REDIRECT_LENGTH) return null;

  const forms = decodedForms(raw);
  if (forms === null || forms.some(hasForbiddenForm)) return null;

  let url: URL;
  try {
    url = new URL(raw, PARSE_BASE);
  } catch {
    return null;
  }
  if (url.origin !== PARSE_BASE || isBlockedPath(url.pathname)) return null;

  // Rebuilt from the parsed URL, never the raw input. Dot segments are resolved by the parser ("/.//evil.com"
  // becomes "//evil.com"), so the result gets the same shape check as the input.
  const target = `${url.pathname}${url.search}${url.hash}`;
  return target.length <= MAX_REDIRECT_LENGTH && !hasForbiddenForm(target) ? target : null;
}

/**
 * A safe same-origin path (with its query and fragment) for a raw `redirect` value, or `/dashboard`.
 *
 * Accepts only a string that is `/` or starts with one `/` and a character that is not `/` or `\`; at most
 * 512 characters; no control, separator or bidirectional characters, no backslash, no `://`; the same holds
 * after decoding it once and twice (a failed decode is refused); and it is not a sign-in page, an `/api` route
 * handler, `/go`, the one-click unsubscribe handler or `/_next`. Anything else, including arrays, `null` and
 * `undefined`, gives the default.
 */
export function resolveSafeRedirect(raw: unknown): string {
  return parseSafeRedirect(raw) ?? DEFAULT_SIGN_IN_REDIRECT;
}
