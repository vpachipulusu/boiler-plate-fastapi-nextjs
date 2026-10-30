import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { OfferType } from '@/lib/catalogue/types';
import { cn } from '@/lib/utils';
import { CTA_LABELS, REQUEST_KIND } from './offer-format';

/** Every anchor to `/go/<id>` carries these: paid links are `sponsored`, the owner also wants `nofollow`. */
export const OUTBOUND_LINK_REL = 'sponsored nofollow noopener';

interface OutboundLinkProps {
  offerId: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * The one place that renders a link to the first-party redirect. It is a plain `<a>`, not `next/link`:
 * `Link` prefetches when it scrolls into view, which would load `/go/<id>` and could count a click the
 * visitor never made.
 */
export function OutboundLink({ offerId, className, children }: OutboundLinkProps) {
  return (
    <a href={`/go/${encodeURIComponent(offerId)}`} rel={OUTBOUND_LINK_REL} className={className}>
      {children}
    </a>
  );
}

interface AffiliateCtaProps {
  offerId: string;
  offerType: OfferType;
}

/**
 * Call to action for a real offer: the "Ad" label comes first, then the button, then the commission
 * sentence (docs/compliance/uk-affiliate-checklist.md A1, A2). Wording is for the legal reviewer to confirm.
 */
export function AffiliateCta({ offerId, offerType }: AffiliateCtaProps) {
  return (
    <div>
      <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-foreground">Ad</p>
      <OutboundLink
        offerId={offerId}
        className={cn(
          buttonVariants({ variant: 'accent' }),
          'h-14 w-full justify-between rounded-pill px-7 text-base font-bold shadow-sm'
        )}
      >
        {CTA_LABELS[offerType]}
        <ArrowRight aria-hidden="true" />
      </OutboundLink>
      <p className="mt-3 px-3 text-xs text-muted-foreground">
        Freejoy is paid a commission by the brand if you take up this offer through this link.
      </p>
      <p className="mt-1 px-3 text-xs text-muted-foreground">
        This takes you to the brand&apos;s website to request your {REQUEST_KIND[offerType]}.{' '}
        <Link href="/affiliate-disclosure" className="underline underline-offset-2">
          Affiliate disclosure
        </Link>
      </p>
    </div>
  );
}
