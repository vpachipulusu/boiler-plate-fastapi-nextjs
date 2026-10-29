import { toCatalogueHref, withQuery, type CatalogueQuery } from '@/lib/catalogue';
export { isRefinedQuery as hasActiveRefinement } from '@/lib/seo/indexing';

export function categoryPath(slug: string): string {
  return `/category/${slug}`;
}

/** The page every "Clear filters" control returns to. */
export function catalogueBasePath(scopeCategory?: string): string {
  return scopeCategory ? categoryPath(scopeCategory) : '/freebies';
}

/**
 * The URL a catalogue control points to: the current query with `patch` applied (any filter change
 * resets to page 1). On a category page (`scopeCategory` set) the category lives in the path, so it
 * is kept out of the query string.
 */
export function catalogueHref(
  query: CatalogueQuery,
  patch: Partial<CatalogueQuery>,
  scopeCategory?: string
): string {
  const next = withQuery(query, patch);
  if (scopeCategory) {
    return toCatalogueHref({ ...next, category: null }, categoryPath(scopeCategory));
  }
  return toCatalogueHref(next);
}

/** Adds the type if absent, removes it if present. Never mutates the input. */
export function toggleType<T extends string>(types: readonly T[], type: T): T[] {
  return types.includes(type) ? types.filter((entry) => entry !== type) : [...types, type];
}

/** Count shown on the mobile "Filter" button: the filters that live inside the drawer. */
export function drawerFilterCount(query: CatalogueQuery): number {
  return query.types.length + (query.postage ? 1 : 0) + (query.sort !== 'newest' ? 1 : 0);
}
