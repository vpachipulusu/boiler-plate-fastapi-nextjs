'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { OfferType } from '@/lib/catalogue/types';
import { CTA_LABELS, REQUEST_KIND } from './offer-format';

interface OfferCtaProps {
  offerType: OfferType;
  /** True for fixture offers (design preview); false for real catalogue offers. */
  demo: boolean;
}

/** Wording for the dialog and the notes under the button; nothing here links off-site yet. */
function ctaCopy(demo: boolean, offerType: OfferType) {
  if (demo) {
    return {
      title: 'Demo offer',
      description: 'This is a design preview with sample data, so there is nothing to claim yet.',
      bullets: [
        'Real offers will link to the provider through a Freejoy redirect, with an affiliate disclosure next to the button.',
        'Nothing was clicked through and no other website was opened.',
      ],
      note: `Demo offer: this button stays on Freejoy. A real offer will take you to the brand's website to request your ${REQUEST_KIND[offerType]}.`,
      disclosure: ': on real offers we may earn a commission if you qualify.',
    };
  }
  return {
    title: 'Claim link coming soon',
    description:
      'Freejoy does not send you on to the provider from this page yet, so there is nothing to claim here right now.',
    bullets: [
      'Once it is switched on, this button will take you to the provider’s own website, with an affiliate disclosure next to it.',
      'Nothing was clicked through and no other website was opened.',
    ],
    note: `This button stays on Freejoy for now. Once the claim link is live it will take you to the brand's website to request your ${REQUEST_KIND[offerType]}.`,
    disclosure: ': we may earn a commission if you qualify.',
  };
}

/**
 * Primary call to action. No offer has a destination yet (the `/go/[id]` redirect is Phase 3), so
 * the button opens a dialog instead of linking out: nothing here renders an external href. A real
 * offer's button says "Coming soon" on its face so it never promises a claim it cannot make. The
 * ended state is rendered by the (server) hero instead of this client component.
 */
export function OfferCta({ offerType, demo }: OfferCtaProps) {
  const copy = ctaCopy(demo, offerType);
  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="accent"
            aria-label={demo ? undefined : `${CTA_LABELS[offerType]}, coming soon`}
            className={cn(
              'w-full justify-between rounded-pill px-7 text-base font-bold shadow-sm',
              demo ? 'h-14' : 'h-auto min-h-14 whitespace-normal py-2.5 text-start'
            )}
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {CTA_LABELS[offerType]}
              {!demo && (
                <span className="rounded-pill border border-current px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                  Coming soon
                </span>
              )}
            </span>
            <ArrowRight aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-card">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
          <ul className="list-disc space-y-2 ps-5 text-sm text-foreground">
            {copy.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-pill">
              Got it
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <p className="mt-3 px-3 text-xs text-muted-foreground">{copy.note}</p>
      <p className="mt-1 px-3 text-xs text-muted-foreground">
        <Link href="/affiliate-disclosure" className="underline underline-offset-2">
          Affiliate disclosure
        </Link>
        {copy.disclosure}
      </p>
    </div>
  );
}
