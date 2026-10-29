import 'server-only';

import { ALERTS_CONSENT_SOURCE } from '@/lib/alerts/consent';
import { callBackend, type ApiResult } from './server';
import {
  confirmAlertSubscription,
  subscribeToAlerts,
  unsubscribeFromAlerts,
  type SubscribeBody,
} from './generated';

/**
 * Server-only calls to the alerts sign-up API (`/v1/subscribers`, internal key, no session). Server
 * actions and the one-click route import these instead of the generated SDK (ADR-008). Tokens and
 * addresses travel only in request bodies and are never logged here.
 */

const PUBLIC = { withSession: false, requireInternalKey: true } as const;

export type SubscribeInput = Omit<SubscribeBody, 'consent' | 'consent_source'>;

export function startAlertsSubscription(input: SubscribeInput): Promise<ApiResult<unknown>> {
  return callBackend(
    (client) =>
      subscribeToAlerts({
        client,
        body: { ...input, consent: true, consent_source: ALERTS_CONSENT_SOURCE },
      }),
    PUBLIC
  );
}

export function confirmAlertsSubscription(token: string): Promise<ApiResult<unknown>> {
  return callBackend((client) => confirmAlertSubscription({ client, body: { token } }), PUBLIC);
}

export function unsubscribeFromAlertEmails(token: string): Promise<ApiResult<unknown>> {
  return callBackend((client) => unsubscribeFromAlerts({ client, body: { token } }), PUBLIC);
}
