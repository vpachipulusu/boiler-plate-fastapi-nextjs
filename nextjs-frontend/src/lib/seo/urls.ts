import { siteConfig } from '@/config/site';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost');
}

/**
 * Validates the configured origin for production: it must be a valid https URL. A loopback host is
 * allowed over http because CI and the local e2e scripts build a production bundle for
 * `http://localhost:3000`.
 */
function assertProductionOrigin(configured: string): void {
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('NEXT_PUBLIC_APP_URL is not a valid URL; cannot build canonical URLs.');
  }
  if (parsed.protocol !== 'https:' && !isLoopback(parsed)) {
    throw new Error('NEXT_PUBLIC_APP_URL must use https in production.');
  }
}

/**
 * The site origin without a trailing slash; reads the env at call time.
 * - Production (not on Vercel) with `NEXT_PUBLIC_APP_URL` unset: throws, so canonicals, the sitemap
 *   and JSON-LD can never point at localhost.
 * - Production with a value: it must be a valid https URL (loopback excepted).
 * - Vercel with it unset: `https://${VERCEL_URL}`. Dev and test: the `siteConfig.url` fallback.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (configured) {
    if (isProduction) assertProductionOrigin(configured);
    return configured.replace(/\/+$/, '');
  }
  if (isProduction && !process.env.VERCEL_ENV) {
    throw new Error('NEXT_PUBLIC_APP_URL must be set in production to build canonical URLs.');
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return siteConfig.url.replace(/\/+$/, '');
}

/** Encodes each path segment so a slug with `?`, `#` or a space cannot change the URL shape. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => (segment === '' ? segment : encodeURIComponent(segment)))
    .join('/');
}

/** Turns a site path into an absolute URL, percent-encoding each path segment. */
export function absoluteUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${siteOrigin()}${encodePath(normalised)}`;
}

/**
 * Absolute URL for a fixed template such as `/freebies?q={search_term_string}`. Nothing is encoded,
 * so the schema.org `SearchAction` placeholder keeps its braces. Never pass user data here.
 */
export function absoluteTemplateUrl(template: string): string {
  return `${siteOrigin()}${template.startsWith('/') ? template : `/${template}`}`;
}
