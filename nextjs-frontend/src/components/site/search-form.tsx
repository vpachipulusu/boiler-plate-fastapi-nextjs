import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchFormProps {
  /** Current query, when rendered on the catalogue page. */
  defaultValue?: string;
  placeholder?: string;
  /** Compact pill for the header; full-width card with a button for the catalogue hero. */
  variant?: 'header' | 'hero';
  autoFocus?: boolean;
  className?: string;
  id?: string;
  /** Extra query params to carry into the search, for example the active catalogue filters. */
  hiddenParams?: [string, string][];
}

export const MAX_QUERY_LENGTH = 80;

/**
 * Plain GET form to /freebies?q=. Works without JavaScript and keeps the query in the URL, so the
 * catalogue page is the single owner of search state.
 */
export function SearchForm({
  defaultValue = '',
  placeholder = 'Search freebies',
  variant = 'header',
  autoFocus = false,
  className,
  id = 'site-search',
  hiddenParams = [],
}: SearchFormProps) {
  const isHero = variant === 'hero';
  return (
    <form
      action="/freebies"
      method="get"
      role="search"
      aria-label={isHero ? 'Search the catalogue' : 'Search freebies'}
      className={cn('flex items-center gap-2', className)}
    >
      {hiddenParams.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={id} className="sr-only">
        Search freebies
      </label>
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={MAX_QUERY_LENGTH}
          autoFocus={autoFocus}
          className={cn(
            'w-full border bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground hover:border-ring',
            isHero
              ? 'h-14 rounded-card border-border pr-28 shadow-sm'
              : 'h-11 rounded-pill border-border bg-muted'
          )}
        />
        {isHero && (
          <button
            type="submit"
            className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-pill bg-cta px-5 text-sm font-bold text-cta-foreground transition-colors hover:bg-cta-hover"
          >
            Search
          </button>
        )}
      </div>
      {!isHero && (
        <button type="submit" className="sr-only">
          Search
        </button>
      )}
    </form>
  );
}
