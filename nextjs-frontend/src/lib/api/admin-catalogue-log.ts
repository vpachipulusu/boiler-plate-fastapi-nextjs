import 'server-only';

import { logger } from '@/lib/logger';
import type { ApiResult } from './server';

type FailedResult = Extract<ApiResult<unknown>, { success: false }>;

/** Answers the admin can fix or expects (denied, missing, refused by a rule, invalid, rate limited): not worth an error log. */
const EXPECTED_STATUSES: readonly number[] = [401, 403, 404, 409, 422, 429];

/**
 * Logs a failed admin catalogue call that nobody could have expected (5xx, unreachable). It records the
 * status and the stable code only, never the backend text. A denied or invalid request is logged by nobody:
 * the page also renders for a non-admin whose redirect is still in flight, and that is not an error.
 */
export function logCatalogueFailure(message: string, result: FailedResult): void {
  if (result.status !== undefined && EXPECTED_STATUSES.includes(result.status)) return;
  logger.error(message, { status: result.status, code: result.code });
}
