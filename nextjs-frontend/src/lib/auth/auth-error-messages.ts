/**
 * the one message the auth server actions return when the sign-in service itself is down or
 * failing (backend unreachable, 5xx, not configured), as opposed to refusing the user's token. It lives
 * outside the `"use server"` actions file because that file may only export async functions. It is display
 * text only: the outage is signalled by `data.serviceUnavailable` on the action response, never
 * by matching this text, and it never carries backend detail.
 */
export const SIGN_IN_SERVICE_UNAVAILABLE_ERROR = 'Sign-in service unavailable';

/** Typed outage marker on an auth action response, the same pattern as `data.signInRequired`. */
export interface ServiceUnavailableData {
  serviceUnavailable: true;
}

/**
 * Display text for the two-factor and rate-limit refusals of an explicit sign-in. Like the outage text it is never
 * matched by the forms: they read the typed flags below, and show their own curated copy.
 */
export const TOTP_REQUIRED_ERROR = 'Two-factor code required';
export const TOTP_INVALID_ERROR = 'Invalid two-factor code';
export const SIGN_IN_RATE_LIMITED_ERROR = 'Too many sign-in attempts';

/** Typed marker: the account has two-factor authentication on and no code was sent. */
export interface TotpRequiredData {
  totpRequired: true;
}

/** Typed marker: a code was sent and it was wrong or malformed. */
export interface TotpInvalidData {
  totpInvalid: true;
}

/** Typed marker: the API's sign-in rate limit (or the per-account code limit) answered 429. */
export interface RateLimitedData {
  rateLimited: true;
}

/** The part of a failed auth action response the forms read. */
export interface AuthFailureResult {
  error?: string;
  data?: {
    serviceUnavailable?: boolean;
    totpRequired?: boolean;
    totpInvalid?: boolean;
    rateLimited?: boolean;
  } | null;
}

/** True when an auth action response carries the typed outage flag. */
export function isServiceUnavailableResult(result: AuthFailureResult): boolean {
  return result.data?.serviceUnavailable === true;
}

/** True when sign-in needs the account's two-factor code (the form moves to its code step). */
export function isTotpRequiredResult(result: AuthFailureResult): boolean {
  return result.data?.totpRequired === true;
}

/** True when the two-factor code sent was refused. */
export function isTotpInvalidResult(result: AuthFailureResult): boolean {
  return result.data?.totpInvalid === true;
}

/** True when the sign-in was refused by a rate limit. */
export function isRateLimitedResult(result: AuthFailureResult): boolean {
  return result.data?.rateLimited === true;
}

/**
 * True when a failed backend call means the service is unavailable rather than the request being refused:
 * no HTTP status (unreachable) or a 5xx. 4xx statuses (401, 403, 409, 422, 429) are the backend's answer and
 * keep their own handling.
 */
export function isServiceUnavailable(status: number | undefined): boolean {
  return status === undefined || status >= 500;
}

/** Set on the error `getBackendClient` throws when `BACKEND_API_URL` or `BACKEND_INTERNAL_KEY` is missing. */
export const BACKEND_NOT_CONFIGURED_CODE = 'backend/not-configured';

const OUTAGE_ERROR_CODES = new Set([
  BACKEND_NOT_CONFIGURED_CODE,
  // Firebase Admin / client network failures
  'app/network-error',
  'app/network-timeout',
  'auth/network-request-failed',
  // Node socket errors
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

function errorCode(value: unknown): unknown {
  return typeof value === 'object' && value !== null
    ? (value as { code?: unknown }).code
    : undefined;
}

/**
 * True when a THROWN error means the sign-in service cannot be used (missing backend settings, or a
 * network failure from Firebase Admin or the fetch layer) rather than an unexpected bug. The error text is
 * never used: only its code, or the code of its `cause`.
 */
export function isServiceUnavailableError(error: unknown): boolean {
  const code = errorCode(error);
  const causeCode = errorCode(
    typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined
  );
  return (
    (typeof code === 'string' && OUTAGE_ERROR_CODES.has(code)) ||
    (typeof causeCode === 'string' && OUTAGE_ERROR_CODES.has(causeCode))
  );
}
