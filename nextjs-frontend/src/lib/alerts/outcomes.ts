/**
 * What a visitor may be told about an alerts request. Backend and provider text never reaches the
 * browser: every failure is mapped to one of these curated outcomes by status only.
 */

export type AlertsFailure = 'invalid_link' | 'rate_limited' | 'unavailable' | 'invalid_input';

export const ALERTS_FAILURE_MESSAGES: Record<AlertsFailure, string> = {
  invalid_link:
    'This link is not valid any more. It may have expired or already been used. You can start again from the alerts page.',
  rate_limited: 'Too many attempts. Please wait a little while and try again.',
  unavailable: 'Something went wrong on our side. Please try again in a few minutes.',
  invalid_input: 'Please check your answers and try again.',
};

export type AlertsActionResult =
  | { success: true }
  | { success: false; code: AlertsFailure; error: string };

const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const UNPROCESSABLE = 422;

/** A failed backend result as a curated failure. Only the HTTP status is read, never the message. */
export function failureFor(status: number | undefined): AlertsActionResult {
  const code: AlertsFailure =
    status === BAD_REQUEST
      ? 'invalid_link'
      : status === TOO_MANY_REQUESTS
        ? 'rate_limited'
        : status === UNPROCESSABLE
          ? 'invalid_input'
          : 'unavailable';
  return { success: false, code, error: ALERTS_FAILURE_MESSAGES[code] };
}
