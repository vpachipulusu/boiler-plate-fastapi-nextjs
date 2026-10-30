import { redirect } from 'next/navigation';
import { requireAdminSession, type AdminGateDenial } from '@/lib/api/admin-guard';

/** Where the /admin layout sends each kind of refusal; a page does the same so it never fetches for them. */
const REDIRECTS: Record<Exclude<AdminGateDenial, 'unavailable'>, string> = {
  'no-session': '/login',
  unverified: '/verify-email',
  rejected: '/api/auth/clear-session',
  'not-admin': '/dashboard',
};

/**
 * Call first in every catalogue page, before any backend read. The layout checks too, but layout and page render
 * in parallel, so without this a non-admin's request would still reach the API (and be refused there) while the
 * redirect is in flight. An outage throws, so `error.tsx` renders and no page content is shown.
 */
export async function requireAdminPage(): Promise<void> {
  const gate = await requireAdminSession();
  if (gate.ok) return;
  if (gate.reason === 'unavailable') throw new Error(gate.error);
  redirect(REDIRECTS[gate.reason]);
}
