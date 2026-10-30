'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { offerLifecycleAction } from '@/app/actions/admin/offer-actions';
import type { OfferAction } from '@/lib/admin-catalogue/offer-status';
import { settleAction } from '@/lib/admin-catalogue/settle-action';
import { useToast } from '@/hooks/use-toast';

const SUCCESS_TITLES: Record<OfferAction, string> = {
  publish: 'Offer published',
  unpublish: 'Offer unpublished and back to draft',
  expire: 'Offer marked as expired',
  archive: 'Offer archived',
  verify: 'Offer marked as verified',
};

const FAILURE_TITLES: Record<OfferAction, string> = {
  publish: 'Could not publish',
  unpublish: 'Could not unpublish',
  expire: 'Could not expire',
  archive: 'Could not archive',
  verify: 'Could not mark as verified',
};

/**
 * Runs an offer lifecycle action through its server action and reports the outcome in a toast (an announced,
 * dismissible message). The action refreshes the admin pages and the public catalogue; `router.refresh()` makes
 * the current page pick the change up straight away.
 */
export function useOfferAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function run(offerId: string, action: OfferAction, offerTitle: string): void {
    startTransition(async () => {
      const result = await settleAction(() => offerLifecycleAction(offerId, action));
      if (result.success) {
        toast({ title: SUCCESS_TITLES[action], description: offerTitle });
      } else {
        toast({ variant: 'destructive', title: FAILURE_TITLES[action], description: result.error });
      }
      router.refresh();
    });
  }

  return { run, isPending };
}
