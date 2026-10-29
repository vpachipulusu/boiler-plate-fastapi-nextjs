/**
 * schema.org builders. Scope is deliberately small: `WebSite` (sitelinks search box),
 * `Organization` and `BreadcrumbList`. There is no `Offer` or `Product` markup and no price,
 * availability, rating or review field anywhere: Freejoy lists other merchants' offers, it does not
 * sell them, and none of those values is something the site can state truthfully.
 */
import { siteConfig } from '@/config/site';
import { absoluteUrl, siteOrigin } from './urls';

const CONTEXT = 'https://schema.org';

export interface JsonLdNode {
  '@context': typeof CONTEXT;
  '@type': string;
  [key: string]: unknown;
}

export interface BreadcrumbItem {
  name: string;
  /** Site path such as `/category/beauty`. */
  path: string;
}

export function buildWebSite(): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteOrigin(),
    description: siteConfig.description,
    inLanguage: 'en-GB',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl('/freebies?q={search_term_string}'),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * `logoPath` is only passed once a real brand asset exists in `public/`. The current
 * `icon-*.png.svg` files are placeholders, so no logo is declared yet.
 */
export function buildOrganization(logoPath?: string): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteOrigin(),
    ...(logoPath ? { logo: absoluteUrl(logoPath) } : {}),
  };
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[]): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Serialises for an inline `<script>`: `<` is escaped so a title containing `</script>` or `<!--`
 * cannot close the tag, and the two JS line separators are escaped too.
 */
const BACKSLASH = String.fromCharCode(92);
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

export function serialiseJsonLd(data: JsonLdNode | readonly JsonLdNode[]): string {
  return JSON.stringify(data)
    .replace(/</g, `${BACKSLASH}u003c`)
    .replace(LINE_SEPARATOR, `${BACKSLASH}u2028`)
    .replace(PARAGRAPH_SEPARATOR, `${BACKSLASH}u2029`);
}
