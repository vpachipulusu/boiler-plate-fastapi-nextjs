'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Re-runs the server render of the current page. `aria-disabled` (not `disabled`) while it works, so
 * keyboard focus stays on the button instead of dropping to the page.
 */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      aria-disabled={pending}
      className="min-h-11 rounded-pill font-bold"
      onClick={() => {
        if (pending) return;
        startTransition(() => router.refresh());
      }}
    >
      {pending ? 'Trying again…' : 'Try again'}
    </Button>
  );
}
