/**
 * The alerts consent wording and its choices. One source for what the form shows and what the server
 * action stores as proof of consent, so the record can never drift from the page. The wording is flagged
 * "for legal review" on the privacy page; changing it changes the stored proof for later sign-ups.
 */

export const CONSENT_LEAD =
  'I agree to receive freebie emails from Freejoy. I can unsubscribe at any time. See the ';
export const CONSENT_LINK_TEXT = 'privacy policy';
export const CONSENT_TAIL = '.';

/** Exactly what the visitor sees beside the checkbox. */
export const ALERTS_CONSENT_TEXT = `${CONSENT_LEAD}${CONSENT_LINK_TEXT}${CONSENT_TAIL}`;

/** The form this consent was given on; the backend allowlists the values it accepts. */
export const ALERTS_CONSENT_SOURCE = 'alerts_page' as const;

export const ALERT_FREQUENCIES = [
  { value: 'daily', label: 'Daily highlights' },
  { value: 'weekly', label: 'Weekly round-up' },
] as const;

export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number]['value'];

/** How long a confirmation link works, in the words the pages use. */
export const CONFIRM_WINDOW_TEXT = '24 hours';
