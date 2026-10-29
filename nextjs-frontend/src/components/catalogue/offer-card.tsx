import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FRESHNESS_LABELS, type Merchant, type Offer } from '@/lib/catalogue/types';
import { DemoBadge } from './demo-badge';
import { OfferArt } from './offer-art';
import { OfferTypeBadge } from './offer-type-badge';

interface OfferCardProps {
  offer: Offer;
  merchant: Merchant;
  className?: string;
}

export function offerHref(offer: Offer): string {
  return `/freebies/${offer.slug}`;
}

/**
 * Image-led card (design screens 01, 02, 05, 06): type badge over the art, merchant eyebrow,
 * title, freshness label from the fixture and a "View freebie" link. The whole card is one link
 * target; the demo badge is visible on fixture offers.
 */
export function OfferCard({ offer, merchant, className }: OfferCardProps) {
  const href = offerHref(offer);
  const freshness = offer.freshness ? FRESHNESS_LABELS[offer.freshness] : null;
  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-card border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2',
        className
      )}
    >
      <div className="relative">
        <OfferArt image={offer.image} />
        <OfferTypeBadge type={offer.offerType} className="absolute left-3 top-3" />
        {/* Below the type badge on narrow two-column cards so the two pills never overlap. */}
        {offer.demo && <DemoBadge className="absolute bottom-3 right-3 sm:bottom-auto sm:top-3" />}
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {merchant.name}
      </p>
      <h3 className="mt-1.5 font-display text-base font-bold leading-snug text-foreground sm:text-lg">
        <Link href={href} className="after:absolute after:inset-0 after:rounded-card">
          {offer.title}
        </Link>
      </h3>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
        {/* The mobile design (screens 05/06) keeps only the link on narrow cards. */}
        {freshness ? (
          <span className="hidden items-center gap-1 whitespace-nowrap text-muted-foreground sm:inline-flex">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {freshness}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 font-bold text-accent-ink group-hover:underline">
          View freebie
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

interface OfferGridProps {
  offers: Offer[];
  merchants: Merchant[];
  className?: string;
}

/** Two columns on phones (10px gap in the design), three at tablet, four on desktop. */
export function OfferGrid({ offers, merchants, className }: OfferGridProps) {
  const bySlug = new Map(merchants.map((merchant) => [merchant.slug, merchant]));
  return (
    <ul
      className={cn('grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 xl:grid-cols-4', className)}
    >
      {offers.map((offer) => {
        // API offers carry their merchant; fixture offers are looked up by slug.
        const merchant = offer.merchant ??
          bySlug.get(offer.merchantSlug) ?? {
            slug: offer.merchantSlug,
            name: offer.merchantSlug,
            logoUrl: null,
          };
        return (
          <li key={offer.id} className="flex">
            <OfferCard offer={offer} merchant={merchant} className="w-full" />
          </li>
        );
      })}
    </ul>
  );
}
