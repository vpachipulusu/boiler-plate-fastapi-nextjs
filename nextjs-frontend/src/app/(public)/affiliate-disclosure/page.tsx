import type { Metadata } from 'next';
import { LegalPage, ReviewerChecklist } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Affiliate disclosure',
  description: 'How Freejoy may earn money from links, in plain language. Draft.',
  robots: { index: false },
};

export default function AffiliateDisclosurePage() {
  return (
    <LegalPage
      title="Affiliate disclosure"
      summary="Some links on Freejoy may earn us a commission. Here is what that means."
      lastReviewed="Not yet reviewed"
    >
      <h2>Affiliate links</h2>
      <p>
        Some links on Freejoy are affiliate links. If you use one and the brand agrees, Freejoy may
        earn a commission. It costs you nothing extra.
      </p>
      <h2>What it does not change</h2>
      <p>
        An affiliate link never changes the terms you get, and it never changes the price or the
        postage you pay. Which offers we feature is an editorial choice made independently of any
        commission.
      </p>
      <h2>In this release</h2>
      <p>
        The design preview contains sample listings only and no outbound links, so no commission can
        be earned from it.
      </p>
      <ReviewerChecklist
        items={[
          'Disclosure wording that meets ASA/CMA guidance and sits next to each affiliate link',
          'How sponsored or paid placements would be labelled, if ever used',
          'Whether the rel attribute and on-page labels are sufficient',
          'Any network-specific disclosure terms',
        ]}
      />
    </LegalPage>
  );
}
