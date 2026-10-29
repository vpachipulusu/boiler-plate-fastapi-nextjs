import { serialiseJsonLd, type JsonLdNode } from '@/lib/seo/json-ld';

interface JsonLdProps {
  data: JsonLdNode | readonly JsonLdNode[];
}

/** Server component: renders structured data in a script tag. It adds nothing visible. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}
