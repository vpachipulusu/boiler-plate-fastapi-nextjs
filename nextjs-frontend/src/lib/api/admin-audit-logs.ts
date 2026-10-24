import 'server-only';

import { callBackend } from './server';
import { listAuditLogs } from './generated';

/**
 * Server-only call to the admin audit log API (`/v1/admin/audit-logs`) for the admin audit log page
 *. The backend authenticates the session and checks the admin permission on every call.
 */

export const AUDIT_LOG_PAGE_SIZE = 100;

export function fetchAdminAuditLogs() {
  return callBackend((client) =>
    listAuditLogs({ client, query: { limit: AUDIT_LOG_PAGE_SIZE, offset: 0 } })
  );
}
