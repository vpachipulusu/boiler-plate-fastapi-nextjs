# ADR-012: Email provider for alerts (Brevo)

- **Status:** Proposed (needs the product owner's sign-off and a provider account)
- **Date:** 2026-10-29
- **Deciders:** product owner (pending)

## Context

Freejoy alerts (FREEJ-24) need a provider that can (a) send our double opt-in confirmation email, (b) hold the list of
confirmed subscribers and send them alerts later, and (c) honour unsubscribes, including the one-click
`List-Unsubscribe` flow that Gmail and Yahoo expect from bulk senders (RFC 8058). The site is UK-focused, so personal
data stays in the UK or EU where we can choose.

We implement the double opt-in ourselves, in our database, because the consent record (wording, time, source) is
ours to prove and the `email_subscribers` table already holds it. The provider is therefore a sender and a list
store, not the source of truth.

**What this comparison is based on.** The author could not browse the web while writing this. Everything below is
from memory of the providers' documentation and pricing pages as they stood in 2025 to mid 2026. Items marked
(unverified) must be checked on the provider's site before the owner signs this off. Prices change often.

## Comparison

| Question | Brevo | Resend |
| --- | --- | --- |
| Double opt-in | Native: double opt-in forms and `POST /v3/contacts/doubleOptinConfirmation`. We do not use it (see above) | None built in. You build it. Same as our plan |
| Data location | Company is French; account data and sending infrastructure in the EU (France, Germany, Belgium) (unverified: exact countries). No UK region | US company on AWS. Sending region can be chosen (including `eu-west-1`, Ireland); where account, contact and log data is stored is not clearly EU (unverified) |
| UK/EU transfer position | EU-to-UK data flows rest on the UK adequacy decision; Brevo's DPA is standard (unverified: current status of the adequacy decision) | US processor: needs a DPA plus transfer tooling (SCCs with the UK addendum, or the Data Privacy Framework if certified) (unverified) |
| List-size pricing | Free tier with unlimited contacts and a daily send cap (300 emails/day, Brevo footer) (unverified). Paid plans are priced by monthly email volume, not by list size | Free tier of about 3,000 emails/month and 100/day (unverified). Paid plans from about 20 USD/month for 50k emails (unverified). Marketing contacts have been priced by audience size (unverified) |
| Unsubscribe handling | Campaigns carry a mandatory unsubscribe link, Brevo keeps a suppression list and adds the `List-Unsubscribe` headers (unverified: one-click `-Post` header on every campaign). The transactional API accepts custom `headers` | Broadcasts carry an unsubscribe URL variable and Resend records unsubscribes. The send API accepts custom `headers`, so `List-Unsubscribe` and `List-Unsubscribe-Post` can be set by us |
| API | REST v3, `api-key` header, plain JSON. Contacts, lists and transactional send | REST, bearer key, very small and clean. Contacts API has been renamed and reshaped more than once (unverified: current shape) |

## Decision

Use **Brevo**, behind a small `EmailProvider` protocol (`app/core/email_provider.py`) so a second provider is one
new class and a config value.

- It is the only one of the two that keeps account data in the EU by default, which is the safer answer for a UK
  consumer list until the owner's lawyer says otherwise.
- It already has lists, suppression and campaign sending, which the later alert-sending work needs. Resend would
  also need its broadcast product and its contact model set up.
- Pricing follows email volume rather than list size, so a growing list costs nothing until it sends more.
- It is called with `httpx`, which is already a dependency. No SDK is added.

How the integration uses it (all unverified against a live account; the adapter is tested only against a mocked HTTP
transport):

- `POST /v3/smtp/email` sends the confirmation email, with `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` as custom headers.
- `POST /v3/contacts` with `updateEnabled: true` adds the contact to the alerts list on confirmation. The text
  attributes `FREQUENCY` and `CATEGORIES` must exist in the Brevo account first.
- `DELETE /v3/contacts/{id}` (`identifierType=contact_id`, or `email_id` when we only have the address) erases the
  contact on unsubscribe, so the provider keeps nothing once someone leaves; our table keeps the suppression row.
  We erase rather than blocklist, because a blocklisted address would also block a later re-subscribe
  confirmation.

Configuration is backend-only (the frontend never sees a provider key): `EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY`,
`EMAIL_FROM`, plus `EMAIL_PROVIDER_LIST_ID`, `EMAIL_FROM_NAME`, `PUBLIC_SITE_URL` and `SUBSCRIBER_TOKEN_SECRET`.
With `EMAIL_PROVIDER` unset nothing is ever sent: a disabled provider logs that it dropped a message, without the
address. `EMAIL_PROVIDER=fake` records messages (and optionally appends them to a local file) and is refused outside
local and test environments.

## Alternatives considered

- **Resend.** Pleasant API, but US-based with unclear EU storage of contact data, no list-level unsubscribe
  management comparable to Brevo's without its broadcast product, and contact-based pricing at scale (all
  unverified). Kept as the first fallback: the protocol makes it a day of work.
- **Postmark, SendGrid, Mailgun, Amazon SES.** Not compared in detail. Postmark and SES are transactional senders
  with no list management; the others are US-hosted. They would need us to build the list and suppression
  handling ourselves.
- **Send from our own SMTP.** Deliverability, bounce handling and unsubscribe management are the whole job. No.

## Consequences

- The owner must create a Brevo account, verify the sending domain (SPF, DKIM, DMARC), create the alerts list and
  the two contact attributes, and set the variables above on the backend. None of that exists yet, so alerts stay
  switched off (nothing is sent) until it does.
- The Brevo integration has not been run against the real service. First real send and first real confirm are the
  verification step; expect to adjust the adapter.
- Subscriber consent stays in our database. If the provider is replaced, the list can be rebuilt from `CONFIRMED`
  rows without asking anyone again.
- The data processor list on the privacy page needs Brevo's name and the retention periods once this is accepted.
