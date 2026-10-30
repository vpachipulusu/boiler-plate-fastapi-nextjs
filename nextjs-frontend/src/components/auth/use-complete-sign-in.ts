'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Where every sign-in path (password, two-factor code step, OAuth) goes once the server action has set the
 * session cookie. One place, so a sign-in never lands somewhere the others do not.
 */
export function useCompleteSignIn(): () => void {
  const router = useRouter();
  return useCallback(() => {
    router.push('/dashboard');
    router.refresh();
  }, [router]);
}
