'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  availableOfferActions,
  OFFER_ACTION_LABELS,
  type OfferAction,
  type OfferStatus,
} from '@/lib/admin-catalogue/offer-status';
import { ArchiveDialog } from './archive-dialog';
import { useOfferAction } from './use-offer-action';

type OfferLifecycleButtonsProps = {
  offerId: string;
  offerTitle: string;
  status: OfferStatus;
};

/** The lifecycle steps for the edit page: the same set as the row menu, as visible buttons. */
export function OfferLifecycleButtons({ offerId, offerTitle, status }: OfferLifecycleButtonsProps) {
  const { run, isPending } = useOfferAction();
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const actions = availableOfferActions(status);

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">This offer is archived and cannot be changed.</p>
    );
  }

  function choose(action: OfferAction): void {
    if (action === 'archive') setConfirmingArchive(true);
    else run(offerId, action, offerTitle);
  }

  return (
    <>
      <div role="group" aria-label="Offer status actions" className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === 'publish' ? 'default' : 'outline'}
            disabled={isPending}
            onClick={() => choose(action)}
          >
            {OFFER_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      <ArchiveDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        offerTitle={offerTitle}
        onConfirm={() => run(offerId, 'archive', offerTitle)}
      />
    </>
  );
}
