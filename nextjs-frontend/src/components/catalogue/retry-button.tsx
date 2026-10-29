'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';

const MAIN_ID = 'main-content';

/**
 * Re-runs the server render of the current page. `aria-disabled` (not `disabled`) while it works, so
 * keyboard focus stays on the button instead of dropping to the page. When the retry succeeds the
 * button unmounts and the browser drops focus on the body; the page's main landmark takes it instead
 * (the public layout's `main` has tabIndex -1), so a keyboard user is not sent back to the top.
 */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const clicked = useRef(false);

  useEffect(
    () => () => {
      if (!clicked.current) return;
      // After the unmount has settled: only move focus if it was really lost.
      setTimeout(() => {
        if (document.activeElement === document.body) document.getElementById(MAIN_ID)?.focus();
      }, 0);
    },
    []
  );

  return (
    <Button
      type="button"
      variant="outline"
      aria-disabled={pending}
      className="min-h-11 rounded-pill font-bold"
      onClick={() => {
        if (pending) return;
        clicked.current = true;
        startTransition(() => router.refresh());
      }}
    >
      {pending ? 'Trying again…' : 'Try again'}
    </Button>
  );
}
