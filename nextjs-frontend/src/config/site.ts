/**
 * Single source of truth for brand strings. Everything that needs the app name,
 * description, URL or support email (metadata, manifest, logger, admin settings, seed scripts)
 * reads it from here. The backend's 2FA issuer is its own `TOTP_ISSUER` setting; keep the two equal.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Freejoy',
  description:
    'Discover UK free samples, trials and offers, with postage and terms shown before you click.',
  keywords: ['free samples UK', 'freebies', 'free trials', 'UK offers', 'free stuff'],
  tagline: 'Good things, terms upfront.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com',
  ogImage: '/og-image.png',
};

export type SiteConfig = typeof siteConfig;
