/** Paging limits of the admin audit log list. Client-safe: shared by the page, its query parser and the API wrapper. */

/** Page sizes the filter form offers. The API accepts 1 to 100; these are the allow-listed choices. */
export const AUDIT_LOG_PAGE_SIZES = [25, 50, 100] as const;
export type AuditLogPageSize = (typeof AUDIT_LOG_PAGE_SIZES)[number];

/** The API's own default page size. */
export const DEFAULT_AUDIT_LOG_PAGE_SIZE: AuditLogPageSize = 50;

/** The API refuses an offset past this: narrow the filters or the date range to reach older rows. */
export const MAX_AUDIT_LOG_OFFSET = 10_000;
