import type { Metadata } from 'next';
import { confirmAlertsAction } from '@/app/actions/alerts-actions';
import { TokenActionPanel, type TokenActionCopy } from '@/components/alerts/token-action-panel';
import { CONFIRM_WINDOW_TEXT } from '@/lib/alerts/consent';

/**
 * Landing page of the confirmation link. Never indexed, never sends a Referer (the address carries a
 * token), and changes nothing on load: a person presses the button, so mail scanners cannot confirm.
 */
export const metadata: Metadata = {
  title: 'Confirm your alerts',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const COPY: TokenActionCopy = {
  heading: 'Confirm your free alerts',
  intro: `One last step. Press the button to start your alerts. The link in your email works for ${CONFIRM_WINDOW_TEXT}.`,
  button: 'Confirm my alerts',
  working: 'Confirming…',
  doneHeading: 'You are signed up',
  doneBody: 'Thank you. Your alerts are confirmed, and every email has an unsubscribe link.',
  doneLink: { href: '/freebies', label: 'Browse freebies' },
};

export default function ConfirmAlertsPage() {
  return <TokenActionPanel copy={COPY} action={confirmAlertsAction} />;
}
