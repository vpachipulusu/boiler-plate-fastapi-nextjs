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
        The design preview does not save the details you type into its forms. The alerts form does
        not store your email address and the contact form is switched off.
      </p>
      <p>
        Like any website, the service that hosts Freejoy handles technical details of each request,
        such as your IP address and browser type, to deliver pages and keep the site secure. If
        error reporting is switched on, details of a fault, which can include the same technical
        details, may be sent to our error-monitoring provider. Who these providers are and how long
        they keep the details will be added here.
      </p>
      <p>
        One more thing to know: if you type your email address into the sign-up box on the home
        page, it is carried to the alerts page in the page address. That means it can appear in
        request logs and browser history, even though the site itself saves nothing.
      </p>
      <h2>What we expect to collect later</h2>
      <p>
        If alerts go live, we expect to hold the email address you give us, the categories and
        frequency you choose, and a record of when and how you agreed, so we can send the alerts you
        asked for and show that you asked. We plan to email you a confirmation link first and send
        nothing else until you use it. Every alert email is planned to carry an unsubscribe link,
        and an address that has unsubscribed would be kept on a list only so that it is not emailed
        again.
      </p>
      <p>
        When real offers go live, we plan to count how many times each offer&apos;s button is used.
        The plan is to record which offer and when, without your IP address, a cookie identifier or
        an account identifier. This is a plan, not something running today.
      </p>
      <p>
        Details of who processes this data, how long it is kept and how to ask for it to be removed
        will be added here.
      </p>
      <h2>Your rights</h2>
      <p>
        Under UK data protection law you have rights to access, correct and delete your personal
        information, to object to direct marketing and, where we rely on your consent, to withdraw
        it. You can also complain to the Information Commissioner&apos;s Office. The final wording
        and a contact route will be added after review.
      </p>
      <ReviewerChecklist
        items={[
          'Controller identity (legal name and address) and the data protection contact route',
          'Lawful basis for each purpose (consent for alerts, legitimate interests for site security)',
          'Whether the planned outbound-click counts are personal data',
          'Retention periods for subscriber, confirmation-token and contact data',
          'Named processors (hosting, error monitoring, email sending) and any transfers outside the UK',
          'Right to object to direct marketing, minimum sign-up age and wording of data-subject rights',
          'Complaint route to the ICO and the data protection fee position',
        ]}
      />
    </LegalPage>
  );
}
