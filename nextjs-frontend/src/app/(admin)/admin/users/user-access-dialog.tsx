'use client';

import { useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { banUserAction, unbanUserAction } from '@/app/actions/admin/user-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { settleAction } from '@/lib/admin-catalogue/settle-action';
import { SUSPEND_REASON_MAX } from '@/lib/admin-users/profile-schema';
import { useToast } from '@/hooks/use-toast';

export type UserAccessMode = 'suspend' | 'restore';

type UserAccessDialogProps = {
  mode: UserAccessMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Name or email, shown in the dialog and the toast. */
  userLabel: string;
  /** Where focus goes when the dialog closes: the row menu trigger, which outlives the menu item. */
  returnFocusTo: RefObject<HTMLElement | null>;
};

const COPY = {
  suspend: {
    title: 'Suspend this user?',
    confirm: 'Suspend user',
    pending: 'Suspending…',
    done: 'suspended',
    description:
      'They are signed out and cannot sign in until you restore their access. The change is recorded in the audit log.',
  },
  restore: {
    title: 'Restore access for this user?',
    confirm: 'Restore access',
    pending: 'Restoring…',
    done: 'restored',
    description:
      'They can sign in again. The change is recorded in the audit log. Restoring someone who is not suspended changes nothing.',
  },
} as const;

/**
 * Confirmation for suspending (ban) or restoring (unban) an account. It stays open while the action runs so a
 * refusal (a missing permission, your own account) is shown in place; success closes it, announces the result in
 * a toast and refreshes the page. Suspending takes an optional reason that is stored in the audit log only.
 */
export function UserAccessDialog({
  mode,
  open,
  onOpenChange,
  userId,
  userLabel,
  returnFocusTo,
}: UserAccessDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const copy = COPY[mode];

  function handleOpenChange(next: boolean): void {
    if (pending) return;
    if (!next) {
      setError(null);
      setReason('');
    }
    onOpenChange(next);
  }

  async function confirm(): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await settleAction<{ success: boolean; error?: string }>(() =>
      mode === 'suspend'
        ? banUserAction(userId, reason.trim() || undefined)
        : unbanUserAction(userId)
    );
    setPending(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.');
      return;
    }
    toast({ title: `${userLabel} ${copy.done}` });
    setReason('');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            <span className="break-all font-medium">{userLabel}</span>. {copy.description}
          </DialogDescription>
        </DialogHeader>
        {mode === 'suspend' ? (
          <div className="space-y-2">
            <Label htmlFor={`suspend-reason-${userId}`}>Reason (optional)</Label>
            <Textarea
              id={`suspend-reason-${userId}`}
              value={reason}
              maxLength={SUSPEND_REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={`suspend-reason-hint-${userId}`}
            />
            <p id={`suspend-reason-hint-${userId}`} className="text-sm text-muted-foreground">
              Up to {SUSPEND_REASON_MAX} characters. Kept in the audit log, not shown to the user.
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={mode === 'suspend' ? 'destructive' : 'default'}
            aria-disabled={pending || undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => void confirm()}
          >
            {pending ? copy.pending : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
