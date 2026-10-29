import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'About Freejoy',
  description: 'What Freejoy is, how we look at offers and how to get the most from the site.',
  robots: { index: false },
};

const STEPS = [
  {
    title: 'Find something you like',
    detail: 'Browse by category or search for a brand. Each listing says what the offer is.',
  },
  {
    title: 'Read the terms first',
    detail:
      'Postage, eligibility, card requirements and end dates are set out on each offer page before you click through.',
  },
  {
    title: 'Claim it on the brand’s site',
    detail:
      'You finish the claim with the brand itself. Freejoy does not collect your claim details.',
  },
];

export default function AboutPage() {
  return (
    <LegalPage
      title="About Freejoy"
      summary="Freejoy is a small UK guide to freebies, samples, trials and offers worth a look."
      lastReviewed="Not yet reviewed"
    >
      <h2>What Freejoy is</h2>
      <p>
        Freejoy collects free samples, trials, cashback, vouchers and competitions from brands
        people in the UK might enjoy, and puts the terms in plain words next to each one. We do not
        run the offers; the brand does.
      </p>
      <h2>How we intend to check offers</h2>
      <p>
        The plan: an editor reads the brand&apos;s own page and notes the offer type, any postage,
        whether a card is needed and who can claim. This release is a design preview with sample
        listings, so no offer shown here has been through that process yet. Offers change without
        notice, so always read the brand&apos;s terms before you claim.
      </p>
      <h2 id="how-it-works">How it works</h2>
      <ol>
        {STEPS.map((step) => (
          <li key={step.title}>
            <strong>{step.title}.</strong> {step.detail}
          </li>
        ))}
      </ol>
      <h2>Keeping in touch</h2>
      <p>
        Want the next find in your inbox? <Link href="/alerts">Join the free alerts</Link> or use
        the <Link href="/contact">contact page</Link> to tell us about a problem with a listing.
      </p>
    </LegalPage>
  );
}
