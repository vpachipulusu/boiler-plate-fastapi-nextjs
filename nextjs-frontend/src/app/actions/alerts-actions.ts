'use server';

import { z } from 'zod';
import { logger } from '@/lib/logger';
import { ALERTS_CONSENT_TEXT, type AlertFrequency } from '@/lib/alerts/consent';
import {
  ALERTS_FAILURE_MESSAGES,
  failureFor,
  type AlertsActionResult,
} from '@/lib/alerts/outcomes';
import {
  confirmAlertsSubscription,
  startAlertsSubscription,
  unsubscribeFromAlertEmails,
} from '@/lib/api/subscribers';
import type { ApiResult } from '@/lib/api/server';

/**
 * Alerts sign-up server actions (FREEJ-24). These are the only way the browser reaches the sign-up API:
 * Next.js server actions are POST-only and refuse a cross-origin Origin header, so no extra CSRF token is
 * needed, and the browser never calls FastAPI. Validation is repeated here with Zod; the consent wording
 * and source are set on the server, never taken from the request. Backend and provider text is never
 * returned: failures map to curated messages by HTTP status. Nothing here logs an address or a token.
 */

const MAX_EMAIL_LENGTH = 254;
const MAX_CATEGORIES = 20;
const MAX_TOKEN_LENGTH = 512;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const subscribeSchema = z.object({
  email: z.string().trim().min(1).max(MAX_EMAIL_LENGTH).email(),
  categories: z.array(z.string().regex(SLUG_PATTERN).max(100)).min(1).max(MAX_CATEGORIES),
  frequency: z.enum(['daily', 'weekly']),
  consent: z.literal(true),
});

const tokenSchema = z.string().min(1).max(MAX_TOKEN_LENGTH);

const FREQUENCY_TO_BACKEND: Record<AlertFrequency, 'DAILY' | 'WEEKLY'> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
};

const INVALID_INPUT: AlertsActionResult = {
  success: false,
  code: 'invalid_input',
  error: ALERTS_FAILURE_MESSAGES.invalid_input,
};
const INVALID_LINK: AlertsActionResult = {
  success: false,
  code: 'invalid_link',
  error: ALERTS_FAILURE_MESSAGES.invalid_link,
};

/** Runs a backend call and folds every outcome (including a thrown configuration error) into a result. */
async function settle(
  operation: string,
  call: () => Promise<ApiResult<unknown>>
): Promise<AlertsActionResult> {
  try {
    const result = await call();
    if (result.success) return { success: true };
    logger.warn('Alerts request failed', { operation, status: result.status });
    return failureFor(result.status);
  } catch (error) {
    // A missing BACKEND_API_URL or key. The name only: messages can carry configuration detail.
    logger.error('Alerts request could not be sent', {
      operation,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return failureFor(undefined);
  }
}

/**
 * Starts a sign-up. The answer is the same whether the address is new, pending, confirmed or
 * unsubscribed: the page says "check your inbox" and never reveals which.
 */
export async function subscribeToAlertsAction(input: unknown): Promise<AlertsActionResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const { email, categories, frequency } = parsed.data;
  return settle('subscribe', () =>
    startAlertsSubscription({
      email,
      categories,
      frequency: FREQUENCY_TO_BACKEND[frequency],
      consent_text: ALERTS_CONSENT_TEXT,
    })
  );
}

/** The visitor pressed "Confirm" on /alerts/confirm; the token came from their email link. */
export async function confirmAlertsAction(token: unknown): Promise<AlertsActionResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return INVALID_LINK;
  return settle('confirm', () => confirmAlertsSubscription(parsed.data));
}

/** The visitor pressed "Unsubscribe" on /alerts/unsubscribe. Repeating it is harmless. */
export async function unsubscribeFromAlertsAction(token: unknown): Promise<AlertsActionResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return INVALID_LINK;
  return settle('unsubscribe', () => unsubscribeFromAlertEmails(parsed.data));
}
