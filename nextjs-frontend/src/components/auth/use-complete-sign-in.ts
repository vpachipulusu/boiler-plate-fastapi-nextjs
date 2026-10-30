'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveSafeRedirect } from '@/lib/auth/safe-redirect';

/**
 * Where every sign-in path (password, two-factor code step, OAuth) goes once the server action has set the
 * session cookie. One place, so a sign-in never lands somewhere the others do not.
 *
 * `redirectTo` is the page the person was sent from (`?redirect=` on the login page). It is checked again here,
 * where it is used, so a value that skipped the page-level check still cannot leave the site; no value, or an
 * unsafe one, means `/dashboard`.
 */
export function useCompleteSignIn(redirectTo?: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    router.push(resolveSafeRedirect(redirectTo));
    router.refresh();
  }, [router, redirectTo]);
}
