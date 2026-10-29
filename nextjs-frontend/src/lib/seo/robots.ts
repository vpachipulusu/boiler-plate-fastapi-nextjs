import type { MetadataRoute } from 'next';
import { absoluteUrl } from './urls';

/** Paths that must never be crawled. `/go/` is the affiliate redirect that Phase 3 adds. */
export const DISALLOWED_PATHS = [
  '/admin',
  '/dashboard',
  '/settings',
  '/profile',
  '/security',
  '/go/',
  '/api/',
  '/login',
  '/signup',
  '/reset-password',
  '/verify-email',
];

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...DISALLOWED_PATHS] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
