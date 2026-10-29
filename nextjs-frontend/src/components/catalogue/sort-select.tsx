import { SORT_KEYS, SORT_LABELS, type CatalogueQuery } from '@/lib/catalogue';
import { cn } from '@/lib/utils';
import { AutoSubmitSelect } from './auto-submit-select';
import { catalogueBasePath } from './catalogue-links';

interface SortSelectProps {
  query: CatalogueQuery;
  scopeCategory?: string;
  className?: string;
}

const SORT_OPTIONS = SORT_KEYS.map((key) => ({ value: key, label: SORT_LABELS[key] }));

/** The active params the form must carry so changing the sort keeps search and filters. Page resets. */
function hiddenParams(query: CatalogueQuery, scopeCategory?: string): [string, string][] {
  const params: [string, string][] = [];
  if (query.q !== '') params.push(['q', query.q]);
  if (query.category !== null && !scopeCategory) params.push(['category', query.category]);
  if (query.types.length > 0) params.push(['type', query.types.join(',')]);
  if (query.postage !== null) params.push(['postage', query.postage]);
  return params;
}

/**
 * Sort control (design screen 02): a GET form with a native select. A tiny client component submits
 * on change; the Apply button keeps it usable without JavaScript.
 */
export function SortSelect({ query, scopeCategory, className }: SortSelectProps) {
  return (
    <form
      action={catalogueBasePath(scopeCategory)}
      method="get"
      className={cn('flex items-center gap-2', className)}
    >
      {hiddenParams(query, scopeCategory).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="catalogue-sort" className="sr-only">
        Sort by
      </label>
      <AutoSubmitSelect
        id="catalogue-sort"
        name="sort"
        defaultValue={query.sort}
        options={SORT_OPTIONS}
        className="h-11 rounded-input border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm hover:border-ring"
      />
      <button
        type="submit"
        className="h-11 rounded-pill px-3 text-sm font-bold text-accent-ink hover:underline"
      >
        Apply
      </button>
    </form>
  );
}
