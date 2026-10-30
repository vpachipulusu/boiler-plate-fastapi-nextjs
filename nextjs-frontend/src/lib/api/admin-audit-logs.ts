import 'server-only';

import { DEFAULT_AUDIT_LOG_PAGE_SIZE } from '@/lib/admin-audit/paging';
import { callBackend } from './server';
import { listAuditLogs } from './generated';

/**
 * Server-only call to the admin audit log API (`/v1/admin/audit-logs`) for the admin audit log page.
 * The backend authenticates the session and checks the admin permission on every call.
 *
 * Callers pass already-validated values (the page parses its URL with Zod first). Unset filters are omitted
 * from the request, and each value travels as a query parameter, never as part of the path.
 */

export const AUDIT_LOG_PAGE_SIZE = DEFAULT_AUDIT_LOG_PAGE_SIZE;

export interface AuditLogListParams {
  action?: string;
  userId?: string;
  organizationId?: string;
  /** ISO 8601 instant with a UTC offset. */
  createdFrom?: string;
  /** ISO 8601 instant with a UTC offset (inclusive). */
  createdTo?: string;
  limit?: number;
  offset?: number;
}

export function fetchAdminAuditLogs(params: AuditLogListParams = {}) {
  return callBackend((client) =>
    listAuditLogs({
      client,
      query: {
        limit: params.limit ?? AUDIT_LOG_PAGE_SIZE,
        offset: params.offset ?? 0,
        ...(params.action ? { action: params.action } : {}),
        ...(params.userId ? { user_id: params.userId } : {}),
        ...(params.organizationId ? { organization_id: params.organizationId } : {}),
        ...(params.createdFrom ? { created_from: params.createdFrom } : {}),
        ...(params.createdTo ? { created_to: params.createdTo } : {}),
      },
    })
  );
}
