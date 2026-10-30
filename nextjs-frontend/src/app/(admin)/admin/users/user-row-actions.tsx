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
  /** Name or email, so the trigger and the dialog name the person. */
  userLabel: string;
};

/**
 * The row menu: View Details and Edit User navigate; Suspend User and Restore Access open a confirmation
 * dialog and call the admin users API (which audits the change). The list does not show who is suspended, so
 * both are always offered: restoring a user who is not suspended leaves their access as it is.
 */
export function UserRowActions({ userId, userLabel }: UserRowActionsProps) {
  const [mode, setMode] = useState<UserAccessMode>('suspend');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const userPath = `/admin/users/${encodeURIComponent(userId)}`;

  function openDialog(next: UserAccessMode): void {
    setMode(next);
    setOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost" className="size-11 p-0 hover:bg-accent">
            <span className="sr-only">Open menu for {userLabel}</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={userPath} className="flex items-center">
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={`${userPath}/edit`} className="flex items-center">
              <Edit className="mr-2 h-4 w-4" />
              Edit User
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 text-destructive focus:text-destructive"
            onSelect={() => openDialog('suspend')}
          >
            <Ban className="mr-2 h-4 w-4" />
            Suspend User
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => openDialog('restore')}>
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
        userLabel={userLabel}
        returnFocusTo={triggerRef}
      />
    </>
  );
}
