import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A native select styled like Input: 44px tall, keyboard and screen-reader behaviour for free, and it works
 * inside a plain GET form with no script. Used by the admin filters and forms.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm shadow-sm transition-all hover:border-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
NativeSelect.displayName = 'NativeSelect';
