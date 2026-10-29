/**
 * Single source of truth for brand strings. Everything that needs the app name,
 * description, URL or support email (metadata, manifest, TOTP issuer, logger,
 * admin settings, seed scripts) reads it from here.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Freejoy',
  description:
    'Discover genuine UK free samples, trials and offers, with postage and terms shown before you click.',
  keywords: ['free samples UK', 'freebies', 'free trials', 'UK offers', 'free stuff'],
  tagline: 'Good things, zero spend.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com',
  ogImage: '/og-image.png',
};

export type SiteConfig = typeof siteConfig;
