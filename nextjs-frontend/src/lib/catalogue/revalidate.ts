import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOGUE_CACHE_TAG } from '@/lib/api/catalogue';

/**
 * Drops the cached catalogue reads so the next render fetches fresh data. The admin publish, unpublish
 * and expire actions (FREEJ-22) call this after a successful write. Server actions and route handlers
 * only. `paths` additionally revalidates specific pages (for example `/freebies/<slug>`); the pages
 * render dynamically, so the tag alone is enough for catalogue content.
 *
 * `expire: 0` makes the tag stale immediately instead of serving the old data while refreshing.
 */
export function revalidateCatalogue(paths: readonly string[] = []): void {
  for (const path of paths) {
    if (!path.startsWith('/')) throw new TypeError(`revalidateCatalogue: "${path}" is not a path`);
  }
  revalidateTag(CATALOGUE_CACHE_TAG, { expire: 0 });
  for (const path of paths) revalidatePath(path);
}
