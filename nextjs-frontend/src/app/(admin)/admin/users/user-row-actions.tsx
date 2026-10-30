'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Eye, Edit, Ban, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAccessDialog, type UserAccessMode } from './user-access-dialog';

type UserRowActionsProps = {
  userId: string;
  /** Name or email, so the trigger is distinguishable per row for screen readers. */
  userLabel?: string;
};

/**
 * The row menu: View Details and Edit User navigate; Suspend User and Restore Access open a confirmation
 * dialog and call the admin users API (which audits the change). The list does not show who is suspended, so
 * both are always offered: restoring a user who is not suspended is a harmless no-op.
 */
export function UserRowActions({ userId, userLabel }: UserRowActionsProps) {
  const [mode, setMode] = useState<UserAccessMode>('suspend');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = userLabel ?? 'this user';

  function openDialog(next: UserAccessMode): void {
    setMode(next);
    setOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost" className="size-11 p-0 hover:bg-accent">
            <span className="sr-only">
              {userLabel ? `Open menu for ${userLabel}` : 'Open menu'}
            </span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${userId}`} className="flex items-center">
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${userId}/edit`} className="flex items-center">
              <Edit className="mr-2 h-4 w-4" />
              Edit User
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => openDialog('suspend')}
          >
            <Ban className="mr-2 h-4 w-4" />
            Suspend User
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog('restore')}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore Access
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UserAccessDialog
        mode={mode}
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        userLabel={label}
        returnFocusTo={triggerRef}
      />
    </>
  );
}
