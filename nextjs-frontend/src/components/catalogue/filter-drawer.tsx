'use client';

import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SlidersHorizontal, X } from 'lucide-react';
import { DialogOverlay } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FilterDrawerProps {
  /** Filters already applied inside the drawer, shown on the button. */
  activeCount?: number;
  /** Server-rendered filter links. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Phone and tablet filter sheet. The button opens a Radix dialog bottom sheet (focus trapped,
 * Escape closes, focus returns to the button). Everything inside is a link, so choosing a filter
 * navigates and the sheet closes.
 */
export function FilterDrawer({ activeCount = 0, children, className }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-input border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm hover:bg-muted lg:hidden',
          className
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filter
        {activeCount > 0 && (
          <span className="rounded-pill bg-accent px-2 text-xs text-accent-ink">
            {activeCount}
            <span className="sr-only"> active</span>
          </span>
        )}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={(event) => {
            // A modified click opens a new tab, so this sheet should stay as it is.
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-editorial border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="font-display text-lg font-bold">
              Filter freebies
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="mt-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
