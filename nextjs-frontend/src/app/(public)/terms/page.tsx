import type { Metadata } from 'next';
import { LegalPage, ReviewerChecklist } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Draft terms of use for Freejoy, pending legal review.',
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      summary="The rules for using Freejoy. This is a draft."
      lastReviewed="Not yet reviewed"
    >
      <h2>Using the site</h2>
      <p>
        Freejoy lists offers run by other companies. We do not sell the items, run the offers or
        control who is accepted, so any claim is between you and the brand. Competitions are run by
        the organiser named in the listing, not by Freejoy.
      </p>
      <h2>Accuracy of listings</h2>
      <p>
        We aim to keep listings accurate, but we cannot promise they are, and offers can change or
        end at any time. Check the brand&apos;s own terms before you claim.
      </p>
      <h2>Our responsibility</h2>
      <p>The wording on limits of liability and governing law will be added after legal review.</p>
      <ReviewerChecklist
        items={[
          'Limitation of liability wording suitable for consumers',
          'Governing law and jurisdiction',
          'Acceptable use and intellectual property clauses',
          'How listing errors and takedown requests are handled',
          'Wording on competitions and prize draws run by third parties',
        ]}
      />
    </LegalPage>
  );
}
