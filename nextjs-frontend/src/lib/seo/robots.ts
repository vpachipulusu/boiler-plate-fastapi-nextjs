import type { MetadataRoute } from 'next';
import { absoluteUrl } from './urls';

/** Paths that must never be crawled. `/go/` is the affiliate redirect that Phase 3 adds. */
export const DISALLOWED_PATHS = ['/admin', '/dashboard', '/go/', '/api/', '/login', '/signup'];

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...DISALLOWED_PATHS] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
