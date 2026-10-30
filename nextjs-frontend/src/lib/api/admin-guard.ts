import 'server-only';

import { isEmailNotVerifiedError, verifyVerifiedSessionCookie } from '@/lib/auth/verified-session';
import { isSessionVerificationError } from '@/lib/auth/session-errors';
import { logger } from '@/lib/logger';
import { resolveAdminAccess } from './admin-access';
import { ADMIN_FORBIDDEN_MESSAGE, ADMIN_UNAVAILABLE_MESSAGE } from './admin-errors';

/**
 * The server-side admin gate for admin writes and for the catalogue pages: the caller must hold a verified session
 * AND be an admin before anything else runs. It mirrors the /admin layout (the proxy cannot do this, it has no
 * Node.js). The layout and its pages render in parallel, so a page cannot rely on the layout's redirect to keep
 * it from fetching: each page asks again (`requireAdminPage`). The backend still authorises every call with the
 * admin's own permission, so a missing `offers.publish` or `categories.write` is refused there with a 403.
 *
 * Fails closed: only a confirmed admin passes. The result carries a curated message, never backend text, and a
 * `reason` so a page can redirect exactly as the layout does.
 */

export type AdminGateDenial =
  /** No usable session: the layout sends the visitor to /login. */
  | 'no-session'
  /** A session whose email is not verified: /verify-email. */
  | 'unverified'
  /** A session the backend rejected: the layout clears the cookie. */
  | 'rejected'
  /** A signed-in user who is not an admin: /dashboard. */
  | 'not-admin'
  /** The session or admin check could not be completed: an error page, never a redirect. */
  | 'unavailable';

export type AdminGateResult = { ok: true } | { ok: false; error: string; reason: AdminGateDenial };

function denied(reason: AdminGateDenial): AdminGateResult {
  const error = reason === 'unavailable' ? ADMIN_UNAVAILABLE_MESSAGE : ADMIN_FORBIDDEN_MESSAGE;
  return { ok: false, error, reason };
}

export async function requireAdminSession(): Promise<AdminGateResult> {
  try {
    await verifyVerifiedSessionCookie();
  } catch (error) {
    if (isEmailNotVerifiedError(error)) return denied('unverified');
    if (isSessionVerificationError(error)) return denied('no-session');
    logger.error('Admin gate: session check failed');
    return denied('unavailable');
  }

  const access = await resolveAdminAccess();
  if (access.status === 'admin') return { ok: true };
  if (access.status === 'session-rejected') return denied('rejected');
  if (access.status === 'error') {
    logger.error('Admin gate: admin check failed');
    return denied('unavailable');
  }
  return denied('not-admin');
}
