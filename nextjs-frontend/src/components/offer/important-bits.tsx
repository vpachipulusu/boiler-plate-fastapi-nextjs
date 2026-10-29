import type { Offer } from '@/lib/catalogue/types';
import { postageText } from './offer-format';

interface ImportantBitsProps {
  offer: Offer;
}

interface Row {
  label: string;
  body: React.ReactNode;
}

function buildRows(offer: Offer): Row[] {
  const rows: Row[] = [
    { label: 'Eligibility', body: <p>{offer.eligibility}</p> },
    {
      label: 'Cost & postage',
      body: (
        <>
          <p>Postage: {postageText(offer.postage)}.</p>
          {offer.requiresCard && <p className="mt-1">A payment card is required to start.</p>}
          {offer.subscriptionTerms && (
            <p className="mt-1">
              <span className="font-bold text-foreground">Trial terms: </span>
              {offer.subscriptionTerms}
            </p>
          )}
        </>
      ),
    },
    { label: 'Availability', body: <p>{offer.availability}</p> },
  ];
  if (offer.offerType === 'free_trial' && offer.subscriptionTerms) {
    rows.push({ label: 'Cancellation', body: <p>&ldquo;{offer.subscriptionTerms}&rdquo;</p> });
  }
  return rows;
}

/** White card with a definition grid: label/value rows on phones, columns from 768px. */
export function ImportantBits({ offer }: ImportantBitsProps) {
  const rows = buildRows(offer);
  return (
    <section
      aria-labelledby="important-bits-heading"
      className="rounded-card border border-border bg-card p-5 sm:p-8"
    >
      <h2
        id="important-bits-heading"
        className="font-display text-2xl font-extrabold tracking-tight"
      >
        The important bits
      </h2>
      <dl className="mt-5 grid gap-y-4 md:grid-cols-3 md:gap-x-10">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[7rem_1fr] gap-x-4 border-b border-border pb-4 last:border-b-0 last:pb-0 md:block md:border-b-0 md:pb-0"
          >
            <dt className="text-sm font-bold text-accent-ink">{row.label}</dt>
            <dd className="text-sm text-muted-foreground md:mt-2">{row.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
