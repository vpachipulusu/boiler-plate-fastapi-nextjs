/**
 * Whether the alerts sign-up is open: `ALERTS_FORM_LIVE=true` (server-only, read from the environment when
 * called). Anything else, including unset, means closed. The alerts page and the About page both ask, so
 * the two never disagree about whether alerts work (ADR-012).
 */
export function isAlertsFormLive(): boolean {
  return process.env.ALERTS_FORM_LIVE === 'true';
}
