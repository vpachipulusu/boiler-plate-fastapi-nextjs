import type { Metadata } from 'next';
import { unsubscribeFromAlertsAction } from '@/app/actions/alerts-actions';
import { TokenActionPanel, type TokenActionCopy } from '@/components/alerts/token-action-panel';

/** Landing page of the unsubscribe link in every alert email. Same privacy rules as the confirm page. */
export const metadata: Metadata = {
  title: 'Unsubscribe from alerts',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const COPY: TokenActionCopy = {
  heading: 'Unsubscribe from Freejoy alerts',
  intro: 'Press the button and we will stop sending you alerts.',
  button: 'Unsubscribe me',
  working: 'Unsubscribing…',
  doneHeading: 'You are unsubscribed',
  doneBody:
    'We will not send you any more alerts. We keep your address on a do-not-email list for 12 months so it is not emailed again, then delete it.',
  doneLink: { href: '/', label: 'Back to Freejoy' },
};

export default function UnsubscribeAlertsPage() {
  return <TokenActionPanel copy={COPY} action={unsubscribeFromAlertsAction} />;
}
