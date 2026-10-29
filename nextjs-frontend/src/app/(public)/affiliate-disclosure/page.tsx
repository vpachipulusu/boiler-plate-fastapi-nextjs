import type { Metadata } from 'next';
import { LegalPage, ReviewerChecklist } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Affiliate disclosure',
  description: 'How Freejoy plans to earn money from links, in plain language. Draft.',
  robots: { index: false },
};

export default function AffiliateDisclosurePage() {
  return (
    <LegalPage
      title="Affiliate disclosure"
      summary="How Freejoy plans to earn money from links. Nothing on the site earns money yet."
      lastReviewed="Not yet reviewed"
    >
      <h2>Where things stand</h2>
      <p>
        This release is a design preview with sample listings and no outbound links, so no
        commission can be earned from anything on the site today.
      </p>
      <h2>How we plan to earn money</h2>
      <p>
        When real offers go live, some links to brands are expected to be affiliate links. If you
        take up an offer through one of them, the brand is expected to pay Freejoy a commission. We
        do not expect that to cost you anything extra.
      </p>
      <h2>How the links are planned to work</h2>
      <p>None of this is live yet. The plan is:</p>
      <ul>
        <li>
          Offer buttons will go to a Freejoy address that starts with <code>/go/</code> and then on
          to the brand&apos;s own website.
        </li>
        <li>
          Each of those links will be marked <code>rel=&quot;sponsored nofollow&quot;</code>, so
          search engines can tell it is a paid link.
        </li>
        <li>
          Each offer with an affiliate link will carry an &ldquo;Ad&rdquo; label before the button,
          with a plain sentence saying the brand pays Freejoy a commission if you take up the offer
          through that link. This page is the longer explanation, not a replacement for the label.
        </li>
      </ul>
      <h2>What we aim to keep separate</h2>
      <p>
        We do not plan to let commission change the terms, price or postage shown for an offer, and
        we aim to choose which offers to feature on editorial grounds rather than by what they pay.
        How that works in practice will be set out here before launch.
      </p>
      <h2>Paid placements</h2>
      <p>
        Freejoy does not plan to sell paid placements. If that ever changes, they will be labelled
        as ads.
      </p>
      <ReviewerChecklist
        items={[
          'Wording of the Ad label and the commission sentence, and that it meets ASA/CMA guidance next to each affiliate link',
          'Whether listings with no commission need any label',
          'How sponsored or paid placements would be labelled, if ever used',
          'Whether the rel attribute and on-page labels are sufficient',
          'Any network-specific disclosure terms',
          'Whether the statements about editorial independence can be made, and on what evidence',
        ]}
      />
    </LegalPage>
  );
}
