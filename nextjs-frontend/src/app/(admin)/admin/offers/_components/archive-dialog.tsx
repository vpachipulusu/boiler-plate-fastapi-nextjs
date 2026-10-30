'use client';

import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ArchiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerTitle: string;
  onConfirm: () => void;
  /** Where focus goes when the dialog closes: the control that started the archive. */
  returnFocusTo: RefObject<HTMLElement | null>;
};

/**
 * Archiving is the one lifecycle step with no way back in the admin (there is no unarchive route), so it asks
 * first. The dialog traps focus. It was opened from a menu item or a button that may be gone by the time it
 * closes, so focus is returned to the stable control named by `returnFocusTo`.
 */
export function ArchiveDialog({
  open,
  onOpenChange,
  offerTitle,
  onConfirm,
  returnFocusTo,
}: ArchiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Archive this offer?</DialogTitle>
          <DialogDescription>
            <span className="break-words font-medium">{offerTitle}</span> will leave the public site
            and can no longer be edited, verified or published. Archiving cannot be undone from the
            admin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Archive offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
