import { siteConfig } from '@/config/site';

/** The site origin without a trailing slash (`NEXT_PUBLIC_APP_URL`, falling back to localhost). */
export function siteOrigin(): string {
  return siteConfig.url.replace(/\/+$/, '');
}

/**
 * Turns a site path into an absolute URL. Paths are joined as-is (no encoding), so a template such
 * as `/freebies?q={search_term_string}` keeps its braces for the schema.org `SearchAction`.
 */
export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}
