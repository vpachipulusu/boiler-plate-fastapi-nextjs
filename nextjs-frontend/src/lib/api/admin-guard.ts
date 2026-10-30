import 'server-only';

import { isEmailNotVerifiedError, verifyVerifiedSessionCookie } from '@/lib/auth/verified-session';
import { isSessionVerificationError } from '@/lib/auth/session-errors';
import { logger } from '@/lib/logger';
import { resolveAdminAccess } from './admin-access';
import { ADMIN_FORBIDDEN_MESSAGE, ADMIN_UNAVAILABLE_MESSAGE } from './admin-errors';

/**
 * The server-action gate for admin writes: the caller must hold a verified session AND be an admin before
 * anything else runs. It mirrors the /admin layout (the proxy cannot do this, it has no Node.js), and it is a
 * second line of defence: the backend still authorises every call with the admin's own permission, so a missing
 * `offers.publish` or `categories.write` is refused there with a 403.
 *
 * Fails closed: only a confirmed admin passes. The result carries a curated message, never backend text.
 */

export type AdminGateResult = { ok: true } | { ok: false; error: string };

const DENIED: AdminGateResult = { ok: false, error: ADMIN_FORBIDDEN_MESSAGE };

export async function requireAdminSession(): Promise<AdminGateResult> {
  try {
    await verifyVerifiedSessionCookie();
  } catch (error) {
    if (isSessionVerificationError(error) || isEmailNotVerifiedError(error)) return DENIED;
    logger.error('Admin action: session check failed');
    return { ok: false, error: ADMIN_UNAVAILABLE_MESSAGE };
  }

  const access = await resolveAdminAccess();
  if (access.status === 'admin') return { ok: true };
  if (access.status === 'error') {
    logger.error('Admin action: admin check failed');
    return { ok: false, error: ADMIN_UNAVAILABLE_MESSAGE };
  }
  return DENIED;
}
