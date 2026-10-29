import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOGUE_CACHE_TAG } from '@/lib/api/catalogue';

/** A site path: starts with "/", and has no query, fragment, whitespace or "..". */
const SAFE_PATH = /^\/(?!.*(?:\.\.|[?#\s]))/;

/**
 * Drops the cached catalogue reads so the next render fetches fresh data. The admin publish, unpublish
 * and expire actions (FREEJ-22) call this after a successful write. Server actions and route handlers
 * only. `paths` additionally revalidates specific pages (for example `/freebies/<slug>`). The public
 * pages are `force-dynamic`, so `revalidatePath` is a no-op for them and the tag alone refreshes the
 * catalogue; the argument is kept for the FREEJ-22 contract.
 *
 * `expire: 0` makes the tag stale immediately instead of serving the old data while refreshing.
 */
export function revalidateCatalogue(paths: readonly string[] = []): void {
  for (const path of paths) {
    if (!SAFE_PATH.test(path)) throw new TypeError('revalidateCatalogue: not a plain path');
  }
  revalidateTag(CATALOGUE_CACHE_TAG, { expire: 0 });
  for (const path of paths) revalidatePath(path);
}
