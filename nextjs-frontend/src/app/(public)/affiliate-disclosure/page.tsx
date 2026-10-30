import type { Metadata } from 'next';
import { LegalPage, ReviewerChecklist } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Affiliate disclosure',
  description: 'How links on Freejoy work and how Freejoy earns money from them. Draft.',
  robots: { index: false },
};

export default function AffiliateDisclosurePage() {
  return (
    <LegalPage
      title="Affiliate disclosure"
      summary="How links to brands work on Freejoy and how Freejoy earns money from them."
      lastReviewed="Not yet reviewed"
    >
      <h2>How Freejoy earns money</h2>
      <p>
        Where an offer has a link to a brand, that link is an affiliate link. If you take up the
        offer through it, the brand pays Freejoy a commission. The commission is paid by the brand,
        not by you. Listings that are marked as a demo or sample are illustrations and do not link
        to a brand, so they earn nothing.
      </p>
      <h2>How the links work</h2>
      <ul>
        <li>
          An offer button that leads to a brand goes through a Freejoy address that starts with /go/
          on the way to the brand&apos;s own website. The address of the brand&apos;s website is
          stored by Freejoy and is never taken from the link you click.
        </li>
        <li>These links are marked as a paid link for search engines.</li>
        <li>
          Each offer with an affiliate link carries an &ldquo;Ad&rdquo; label before the button,
          with a plain sentence saying the brand pays Freejoy a commission if you take up the offer
          through that link. This page is the longer explanation, not a replacement for the label.
        </li>
      </ul>
      <h2>What a click records</h2>
      <p>
        When you use one of those buttons, Freejoy counts the click. The count keeps which offer it
        was, the time to the nearest minute, the name of the website you came from (not the page)
        and a rough device type: desktop, mobile, tablet or automated visitor. It does not keep your
        IP address, set a cookie or store any identifier for you, and nothing that identifies you is
        added to the link.
      </p>
      <p>
        Once you reach the brand&apos;s website, or the affiliate network that tracks the click,
        they handle your visit under their own policies and may use cookies of their own. A click
        count is not a count of people who claimed or bought anything.
      </p>
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
