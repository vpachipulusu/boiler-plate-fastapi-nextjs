import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OFFER_TYPES,
  OFFER_TYPE_LABELS,
  SORT_KEYS,
  SORT_LABELS,
  type CatalogueQuery,
} from '@/lib/catalogue';
import { catalogueHref, toggleType } from './catalogue-links';

interface OptionLinkProps {
  href: string;
  selected: boolean;
  /** `radio` = exactly one of a set (categories, sort); `checkbox` = independent toggle. */
  kind: 'radio' | 'checkbox';
  children: React.ReactNode;
  className?: string;
}

/**
 * One filter control. It is a plain link, so it works without JavaScript and Back restores the
 * previous state. The selected state is a visible mark plus `aria-current`, never colour alone.
 */
export function OptionLink({ href, selected, kind, children, className }: OptionLinkProps) {
  return (
    <Link
      href={href}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-pill px-3 text-sm transition-colors hover:bg-muted',
        selected ? 'bg-accent font-bold text-accent-ink' : 'font-semibold text-foreground',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center border',
          kind === 'radio' ? 'rounded-full' : 'rounded-[5px]',
          selected ? 'border-accent-ink bg-accent-ink text-card' : 'border-input bg-card'
        )}
      >
        {selected && kind === 'checkbox' && <Check className="h-3 w-3" strokeWidth={3} />}
        {selected && kind === 'radio' && <span className="h-1.5 w-1.5 rounded-full bg-card" />}
      </span>
      {children}
    </Link>
  );
}

interface OptionsProps {
  query: CatalogueQuery;
  scopeCategory?: string;
}

/** Offer type checkboxes: selecting several widens the results (any of the chosen types). */
export function TypeOptions({ query, scopeCategory }: OptionsProps) {
  return (
    <ul className="space-y-0.5">
      {OFFER_TYPES.map((type) => (
        <li key={type}>
          <OptionLink
            kind="checkbox"
            selected={query.types.includes(type)}
            href={catalogueHref(query, { types: toggleType(query.types, type) }, scopeCategory)}
          >
            {OFFER_TYPE_LABELS[type]}
          </OptionLink>
        </li>
      ))}
    </ul>
  );
}

/** "No postage required" toggle (`postage=free`). */
export function PostageOption({ query, scopeCategory }: OptionsProps) {
  const selected = query.postage === 'free';
  return (
    <OptionLink
      kind="checkbox"
      selected={selected}
      href={catalogueHref(query, { postage: selected ? null : 'free' }, scopeCategory)}
    >
      No postage required
    </OptionLink>
  );
}

/** Sort choices as links, for the phone drawer where a native select is awkward. */
export function SortOptions({ query, scopeCategory }: OptionsProps) {
  return (
    <ul className="space-y-0.5">
      {SORT_KEYS.map((sort) => (
        <li key={sort}>
          <OptionLink
            kind="radio"
            selected={query.sort === sort}
            href={catalogueHref(query, { sort }, scopeCategory)}
          >
            {SORT_LABELS[sort]}
          </OptionLink>
        </li>
      ))}
    </ul>
  );
}

export function FilterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}
