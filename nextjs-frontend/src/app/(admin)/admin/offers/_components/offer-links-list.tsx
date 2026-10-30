import { StatusPill } from '@/components/ui/status-pill';
import type { OfferLinkView } from '@/lib/admin-catalogue/offer-view';

/**
 * The offer's affiliate links, read only. Links are managed through the API for now (the publish rule needs an
 * active link or a source URL); this list shows what the publish rule will see.
 */
export function OfferLinksList({ links }: { links: OfferLinkView[] }) {
  return (
    <section aria-labelledby="offer-links-heading" className="space-y-2">
      <h2 id="offer-links-heading" className="text-base font-semibold">
        Affiliate links
      </h2>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No affiliate links. The offer needs a source URL to be published.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium">{link.provider}</span>
                <span className="block break-all text-muted-foreground">{link.destinationUrl}</span>
              </span>
              <StatusPill variant={link.active ? 'good' : 'neutral'}>
                {link.active ? 'Active' : 'Inactive'}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
