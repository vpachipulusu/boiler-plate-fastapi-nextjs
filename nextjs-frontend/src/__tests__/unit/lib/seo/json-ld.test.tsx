import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbList,
  buildOrganization,
  buildWebSite,
  serialiseJsonLd,
  type JsonLdNode,
} from '@/lib/seo/json-ld';

const FORBIDDEN_KEYS = [
  'offers',
  'price',
  'priceCurrency',
  'availability',
  'aggregateRating',
  'rating',
  'ratingValue',
  'review',
  'reviewCount',
];
const FORBIDDEN_TYPES = ['Offer', 'AggregateOffer', 'Product', 'Review', 'AggregateRating'];

function collect(value: unknown, keys: string[] = [], types: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collect(entry, keys, types));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      if (key === '@type' && typeof entry === 'string') types.push(entry);
      collect(entry, keys, types);
    }
  }
  return { keys, types };
}

const nodes: JsonLdNode[] = [
  buildWebSite(),
  buildOrganization(),
  buildOrganization('/brand/logo.png'),
  buildBreadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Beauty', path: '/category/beauty' },
  ]),
];

describe('json-ld builders', () => {
  it('describes the site with a search action that targets /freebies?q=', () => {
    const site = buildWebSite();

    expect(site).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Freejoy',
      url: 'http://localhost:3000',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'http://localhost:3000/freebies?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    });
  });

  it('declares no organisation logo unless a real asset path is passed', () => {
    expect(buildOrganization()).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Freejoy',
      url: 'http://localhost:3000',
    });
    expect(buildOrganization('/brand/logo.png').logo).toBe('http://localhost:3000/brand/logo.png');
  });

  it('numbers breadcrumb items from 1 with absolute urls', () => {
    expect(buildBreadcrumbList([{ name: 'Home', path: '/' }])).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'http://localhost:3000/' },
      ],
    });
  });

  it('never emits Offer or Product schema, or a price, availability, rating or review field', () => {
    const { keys, types } = collect(nodes);

    expect(types).toEqual(
      expect.arrayContaining(['WebSite', 'Organization', 'BreadcrumbList', 'ListItem'])
    );
    for (const forbidden of FORBIDDEN_KEYS) expect(keys).not.toContain(forbidden);
    for (const forbidden of FORBIDDEN_TYPES) expect(types).not.toContain(forbidden);
  });
});

describe('serialiseJsonLd and JsonLd', () => {
  const hostile = buildBreadcrumbList([
    { name: '</script><script>alert(1)</script> <!--', path: '/' },
  ]);

  it('escapes every < so the data cannot close the script tag', () => {
    const json = serialiseJsonLd(hostile);

    expect(json).not.toContain('<');
    expect(json).toContain('\\u003c/script>');
    expect(JSON.parse(json).itemListElement[0].name).toBe(
      '</script><script>alert(1)</script> <!--'
    );
  });

  it('escapes the JavaScript line separators', () => {
    const json = serialiseJsonLd(
      buildBreadcrumbList([{ name: `a${'\u2028'}b${'\u2029'}c`, path: '/' }])
    );

    expect(json).not.toContain('\u2028');
    expect(json).not.toContain('\u2029');
    expect(JSON.parse(json).itemListElement[0].name).toBe(`a${'\u2028'}b${'\u2029'}c`);
  });

  it('renders one ld+json script and nothing visible', () => {
    const { container } = render(<JsonLd data={[buildWebSite(), buildOrganization()]} />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');

    expect(scripts).toHaveLength(1);
    expect(container.textContent).toBe(scripts[0]?.textContent);
    expect(JSON.parse(scripts[0]?.textContent ?? '[]')).toHaveLength(2);
  });

  it('escapes < inside the rendered script', () => {
    const { container } = render(<JsonLd data={hostile} />);

    expect(container.innerHTML).not.toContain('</script><script>');
    expect(container.querySelector('script')?.textContent).not.toContain('<');
  });
});
