import type { Metadata } from 'next';
import { LegalPage, ReviewerChecklist } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'Draft privacy notice for Freejoy, pending legal review.',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      summary="How Freejoy intends to handle personal information. This is a draft."
      lastReviewed="Not yet reviewed"
    >
      <h2>What this release collects</h2>
      <p>
        The design preview does not save any information. The alerts form does not store your email
        address and the contact form is switched off.
      </p>
      <h2>What we expect to collect later</h2>
      <p>
        If alerts go live, we expect to hold the email address you give us and the categories you
        choose, so we can send the alerts you asked for. Details of who processes that data, how
        long it is kept and how to ask for it to be removed will be added here.
      </p>
      <h2>Your rights</h2>
      <p>
        Under UK data protection law you have rights to access, correct and delete your personal
        information. The final wording and a contact route will be added after review.
      </p>
      <ReviewerChecklist
        items={[
          'Lawful basis for each purpose (consent for alerts, legitimate interests for site security)',
          'Retention periods for subscriber and contact data',
          'Named processors and any transfers outside the UK',
          'Controller identity and the data protection contact route',
          'Complaint route to the ICO and wording of data-subject rights',
        ]}
      />
    </LegalPage>
  );
}
