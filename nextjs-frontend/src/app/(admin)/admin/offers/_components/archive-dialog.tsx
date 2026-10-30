'use client';

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
};

/**
 * Archiving is the one lifecycle step with no way back in the admin (there is no unarchive route), so it asks
 * first. The dialog traps focus and returns it to the control that opened it.
 */
export function ArchiveDialog({ open, onOpenChange, offerTitle, onConfirm }: ArchiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
