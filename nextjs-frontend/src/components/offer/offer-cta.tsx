'use client';

import Link from 'next/link';
import { ArrowRight, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  ended: boolean;
  categorySlug: string;
}

/**
 * Primary call to action. Fixture offers have no destination, so the button opens a "Demo offer"
 * dialog instead of linking out: nothing here renders an external href. When the offer has ended
 * the button is replaced by a calm panel with two ways onward.
 */
export function OfferCta({ offerType, ended, categorySlug }: OfferCtaProps) {
  if (ended) {
    return (
      <section aria-labelledby="offer-ended-heading" className="rounded-card bg-warn p-5">
        <h2
          id="offer-ended-heading"
          className="flex items-center gap-2 font-display text-lg font-bold text-warn-foreground"
        >
          <CalendarOff className="h-5 w-5" aria-hidden="true" />
          This offer has ended
        </h2>
        <p className="mt-2 text-sm text-warn-foreground">
          The provider is no longer accepting requests for this one. There are plenty of other happy
          finds to explore.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold">
          <Link
            href={`/category/${categorySlug}`}
            className="inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline"
          >
            More in this category
          </Link>
          <Link
            href="/freebies"
            className="inline-flex min-h-11 items-center text-accent-ink underline-offset-4 hover:underline"
          >
            Browse all freebies
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="accent"
            className="h-14 w-full justify-between rounded-pill px-7 text-base font-bold shadow-sm"
          >
            {CTA_LABELS[offerType]}
            <ArrowRight aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-card">
          <DialogTitle>Demo offer</DialogTitle>
          <DialogDescription>
            This is a design preview with sample data, so there is nothing to claim yet.
          </DialogDescription>
          <ul className="list-disc space-y-2 ps-5 text-sm text-foreground">
            <li>
              Real offers will link to the provider through a Freejoy redirect, with an affiliate
              disclosure next to the button.
            </li>
            <li>Nothing was clicked through and no other website was opened.</li>
          </ul>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-pill">
              Got it
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <p className="mt-3 px-3 text-xs text-muted-foreground">
        Demo offer: this button stays on Freejoy. A real offer will take you to the brand&apos;s
        website to request your {REQUEST_KIND[offerType]}.
      </p>
      <p className="mt-1 px-3 text-xs text-muted-foreground">
        <Link href="/affiliate-disclosure" className="underline underline-offset-2">
          Affiliate disclosure
        </Link>
        : on real offers we may earn a commission if you qualify.
      </p>
    </div>
  );
}
