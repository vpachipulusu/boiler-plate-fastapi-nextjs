import type { Metadata } from 'next';
import { LegalPage, ReviewerChecklist } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Cookie notice',
  description: 'Draft cookie notice for Freejoy, pending legal review.',
  robots: { index: false },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie notice"
      summary="What Freejoy stores in your browser. This is a draft."
      lastReviewed="Not yet reviewed"
    >
      <h2>Cookies in this release</h2>
      <p>
        This release sets no non-essential cookies and runs no analytics. Nothing here tracks you
        across pages or sites, so there is no cookie banner to accept.
      </p>
      <h2>If that changes</h2>
      <p>
        If analytics or other optional cookies are added later, this page will list each one, what
        it is for and how long it lasts, and we will ask for your consent before setting it.
      </p>
      <ReviewerChecklist
        items={[
          'Final cookie and local-storage list, including strictly necessary items from the framework',
          'Whether any essential item needs to be named and explained',
          'Consent mechanism and wording before any optional cookie is added',
          'Expiry period stated for each item',
        ]}
      />
    </LegalPage>
  );
}
