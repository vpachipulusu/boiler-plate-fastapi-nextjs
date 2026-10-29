import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Category, Tint } from '@/lib/catalogue';

/** Soft background behind the category initial, matching the offer art panels. */
const TINT_BADGE: Record<Tint, string> = {
  blush: 'bg-[#FBE2DA]',
  mint: 'bg-[#DDF4E8]',
  lavender: 'bg-[#EADFF6]',
  sky: 'bg-[#DDEEF9]',
  butter: 'bg-[#FFEDD8]',
  cream: 'bg-[#FFEDD8]',
  sage: 'bg-[#DCE8CF]',
  sand: 'bg-[#EADBC8]',
};

interface CategoryIntroProps {
  category: Category;
  /** Live offers in the whole category, not just the filtered view. */
  total: number;
}

/** Header for /category/[slug]: breadcrumb, tinted initial, h1, intro copy and the live count. */
export function CategoryIntro({ category, total }: CategoryIntroProps) {
  return (
    <header className="mx-auto max-w-content px-4 pt-8 sm:px-6 lg:pt-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
          <li>
            <Link href="/" className="inline-flex min-h-11 items-center hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{category.name}</li>
        </ol>
      </nav>
      <div className="mt-5 flex items-start gap-4 sm:gap-6">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-card font-display text-2xl font-extrabold text-foreground sm:h-16 sm:w-16',
            TINT_BADGE[category.tint]
          )}
        >
          {category.name.charAt(0)}
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {category.name} freebies
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {category.intro}
          </p>
          <p className="mt-3 text-sm font-bold text-accent-ink">
            {total} {total === 1 ? 'freebie' : 'freebies'} in this category
          </p>
        </div>
      </div>
      <div className="mt-8 border-b border-border lg:mt-10" />
    </header>
  );
}
