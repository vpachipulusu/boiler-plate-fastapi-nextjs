import { z } from 'zod';
import {
  DEFAULT_AUDIT_LOG_PAGE_SIZE,
  MAX_AUDIT_LOG_OFFSET,
  type AuditLogPageSize,
} from '@/lib/admin-audit/paging';
import type { AuditLogListParams } from '@/lib/api/admin-audit-logs';

/**
 * The audit log page's URL parameters: validation (Zod, allow-lists and bounds), the values sent to the API, and
 * the links that carry the filters (paging, Reset, Retry). Raw parameters never reach the backend: only the parsed
 * `AuditLogsQuery` does, and a value that fails validation is dropped with a curated notice, never echoed back.
 */

export const AUDIT_LOGS_PATH = '/admin/audit-logs';

const ACTION_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_PATTERN = /^[1-9]\d{0,5}$/;

export type AuditLogsQuery = {
  action: string | undefined;
  user: string | undefined;
  org: string | undefined;
  /** First day to include, `YYYY-MM-DD` (UTC). */
  from: string | undefined;
  /** Last day to include, `YYYY-MM-DD` (UTC). */
  to: string | undefined;
  size: AuditLogPageSize;
  page: number;
};

export type AuditLogsParseResult = {
  query: AuditLogsQuery;
  /** Curated, fixed notices for filters that were dropped. Never contains the rejected value. */
  notices: string[];
};

type RawParams = Record<string, string | string[] | undefined>;

const NOTICES = {
  action: 'The action filter was ignored. Use a code such as admin.offers.update.',
  user: 'The user ID filter was ignored. Use letters, numbers, hyphens and underscores only.',
  org: 'The organisation ID filter was ignored. Use letters, numbers, hyphens and underscores only.',
  from: 'The "From" date was ignored. Pick a valid date.',
  to: 'The "To" date was ignored. Pick a valid date.',
  range: 'Both dates were ignored because "To" is before "From".',
} as const;

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

const actionSchema = z.string().trim().min(3).max(100).regex(ACTION_PATTERN);
const idSchema = z.string().trim().min(1).max(128).regex(ID_PATTERN);
const dateSchema = z.string().regex(DATE_PATTERN).refine(isRealDate);
const sizeSchema = z
  .string()
  .regex(/^(25|50|100)$/)
  .transform(Number)
  .pipe(
    z.union([z.literal(25), z.literal(50), z.literal(100)]) satisfies z.ZodType<AuditLogPageSize>
  );
const pageSchema = z.string().regex(PAGE_PATTERN).transform(Number);

/** The last page whose offset the API still accepts. */
export function maxAuditLogPage(size: AuditLogPageSize): number {
  return Math.floor(MAX_AUDIT_LOG_OFFSET / size) + 1;
}

/** A value that is absent or blank is "not set", not an error. */
function present(value: string | string[] | undefined): string | string[] | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function parseField<T>(
  raw: RawParams,
  key: string,
  schema: z.ZodType<T>,
  notice: string,
  notices: string[]
): T | undefined {
  const value = present(raw[key]);
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  notices.push(notice);
  return undefined;
}

function parseSilently<T>(raw: RawParams, key: string, schema: z.ZodType<T>): T | undefined {
  const value = present(raw[key]);
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseAuditLogsQuery(raw: RawParams): AuditLogsParseResult {
  const notices: string[] = [];
  const action = parseField(raw, 'action', actionSchema, NOTICES.action, notices);
  const user = parseField(raw, 'user', idSchema, NOTICES.user, notices);
  const org = parseField(raw, 'org', idSchema, NOTICES.org, notices);
  let from = parseField(raw, 'from', dateSchema, NOTICES.from, notices);
  let to = parseField(raw, 'to', dateSchema, NOTICES.to, notices);
  if (from && to && from > to) {
    notices.push(NOTICES.range);
    from = undefined;
    to = undefined;
  }
  const size = parseSilently(raw, 'size', sizeSchema) ?? DEFAULT_AUDIT_LOG_PAGE_SIZE;
  const page = Math.min(parseSilently(raw, 'page', pageSchema) ?? 1, maxAuditLogPage(size));

  return { query: { action, user, org, from, to, size, page }, notices };
}

export function hasAuditLogFilters(query: AuditLogsQuery): boolean {
  return Boolean(query.action || query.user || query.org || query.from || query.to);
}

/** The values for the API wrapper. A date becomes the whole UTC day: 00:00:00 to 23:59:59.999 inclusive. */
export function toAuditLogListParams(query: AuditLogsQuery): AuditLogListParams {
  return {
    action: query.action,
    userId: query.user,
    organizationId: query.org,
    createdFrom: query.from ? `${query.from}T00:00:00Z` : undefined,
    createdTo: query.to ? `${query.to}T23:59:59.999Z` : undefined,
    limit: query.size,
    offset: (query.page - 1) * query.size,
  };
}

/** A page link that keeps every filter. Defaults are left out so the URL stays short and bookmarkable. */
export function auditLogsHref(query: Partial<AuditLogsQuery>): string {
  const params = new URLSearchParams();
  if (query.action) params.set('action', query.action);
  if (query.user) params.set('user', query.user);
  if (query.org) params.set('org', query.org);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.size && query.size !== DEFAULT_AUDIT_LOG_PAGE_SIZE)
    params.set('size', String(query.size));
  if (query.page && query.page > 1) params.set('page', String(query.page));
  const qs = params.toString();
  return qs ? `${AUDIT_LOGS_PATH}?${qs}` : AUDIT_LOGS_PATH;
}

/** Which entries are on screen, for example "Showing 51 to 100 of 250 entries". */
export function auditLogsRangeText(query: AuditLogsQuery, shown: number, total: number): string {
  const first = (query.page - 1) * query.size + 1;
  return `Showing ${first} to ${first + shown - 1} of ${total} entries`;
}
