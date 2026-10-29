import Link from 'next/link';
import type { Category, Offer } from '@/lib/catalogue/types';

interface BreadcrumbsProps {
  category: Category;
  offer: Offer;
}

const LINK_CLASS =
  'inline-flex min-h-6 items-center rounded-sm hover:underline focus-visible:underline';

/** Green caption-caps trail: HOME / CATEGORY / OFFER (design screens 03, 07). */
export function Breadcrumbs({ category, offer }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
        <li>
          <Link href="/" className={LINK_CLASS}>
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href={`/category/${category.slug}`} className={LINK_CLASS}>
            {category.name}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{offer.title}</li>
      </ol>
    </nav>
  );
}
