/**
 * Pure checks for the `/go/[offerId]` redirect. Nothing here touches the network or request
 * objects, so every rule can be tested exhaustively.
 *
 * The redirect target comes only from the backend (the stored affiliate link). These helpers decide
 * whether what comes back, and what the visitor sent, is safe to use.
 */

/** Offer ids are cuid2 strings; the pattern also admits older ids. Mirrors the backend path rule. */
const OFFER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Catalogue slugs: lower-case words joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 100;
const MAX_DESTINATION_LENGTH = 2048;
const MAX_HOST_LENGTH = 253;
/** `https://` followed by an authority. WHATWG parsing alone would also accept `https:host` and `https:///host`. */
const HTTPS_WITH_AUTHORITY = /^https:\/\/[^/?#]/i;

export type UserAgentClass = 'DESKTOP' | 'MOBILE' | 'TABLET' | 'BOT' | 'OTHER';

export function isOfferId(value: unknown): value is string {
  return typeof value === 'string' && OFFER_ID_PATTERN.test(value);
}

export function isOfferSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

const BACKSLASH = 0x5c;

/**
 * Space, every control character, DEL, anything outside ASCII, and backslash: none belongs in a URL we
 * redirect to. Non-ASCII hosts must arrive as punycode (as the backend requires), so an IDN lookalike
 * such as a Cyrillic "a" is refused here rather than normalised.
 */
function hasForbiddenCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x20 || code >= 0x7f || code === BACKSLASH) return true;
  }
  return false;
}

/** The WHATWG "ends in a number" rule: decimal digits, or 0x and hex digits (IPv4 in any spelling). */
const NUMERIC_LABEL = /^(?:\d+|0x[0-9a-f]*)$/i;

/**
 * Same host rule as the backend (`validate_https_url`): a DNS name with at least two labels, no
 * trailing dot, no IP literal and a last label that is not a number.
 */
function isPlainDnsHost(hostname: string): boolean {
  if (hostname.startsWith('[') || hostname.endsWith('.') || !hostname.includes('.')) return false;
  const lastLabel = hostname.slice(hostname.lastIndexOf('.') + 1);
  return !NUMERIC_LABEL.test(lastLabel);
}

/**
 * The destination as a `URL`, or null unless it is a clean absolute https URL with a host, no user
 * info and the default port. The backend validates the same way; this second check means a bug or a
 * compromised backend response still cannot produce `javascript:`, `data:`, `http:`, a
 * protocol-relative or userinfo redirect, or a header-splitting value.
 */
export function parseHttpsDestination(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw === '' || raw.length > MAX_DESTINATION_LENGTH) return null;
  if (!HTTPS_WITH_AUTHORITY.test(raw) || hasForbiddenCharacter(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const clean =
    url.protocol === 'https:' &&
    isPlainDnsHost(url.hostname) &&
    url.username === '' &&
    url.password === '' &&
    url.port === '';
  return clean ? url : null;
}

/**
 * Host name of a `Referer` header, lower-cased, or null. Only the host survives: no path, query,
 * port or credentials are kept, and only http(s) referrers count.
 */
export function referrerHost(header: string | null): string | null {
  if (!header) return null;
  let url: URL;
  try {
    url = new URL(header);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  return host !== '' && host.length <= MAX_HOST_LENGTH ? host : null;
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|headless|facebookexternalhit|curl\/|wget|python-requests|httpclient|monitor/;
const TABLET_PATTERN = /ipad|tablet|kindle|silk/;
const MOBILE_PATTERN = /mobi|iphone|ipod|android/;
const DESKTOP_PATTERN = /windows|macintosh|x11|linux|cros/;

/**
 * A coarse device class. The raw user agent is never stored or sent to the backend: only this
 * class leaves the route handler.
 */
export function classifyUserAgent(header: string | null): UserAgentClass {
  const agent = (header ?? '').toLowerCase();
  if (agent === '') return 'OTHER';
  if (BOT_PATTERN.test(agent)) return 'BOT';
  if (TABLET_PATTERN.test(agent) || (/android/.test(agent) && !/mobile/.test(agent))) {
    return 'TABLET';
  }
  if (MOBILE_PATTERN.test(agent)) return 'MOBILE';
  return DESKTOP_PATTERN.test(agent) ? 'DESKTOP' : 'OTHER';
}
