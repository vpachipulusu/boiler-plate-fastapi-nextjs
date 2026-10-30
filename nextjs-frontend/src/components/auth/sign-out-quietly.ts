import { signOut } from '@/lib/firebase/auth-helpers';

/**
 * Signs the Firebase client out of the browser, never throwing to the UI. Used when a sign-in is abandoned half way
 * (the two-factor step is left, or it cannot be finished): the browser must not keep a signed-in Firebase user, whose
 * refresh token would outlive a sign-in that never produced a session.
 */
export async function signOutQuietly(): Promise<void> {
  try {
    await signOut();
  } catch {
    // Nothing useful to show: the person is already leaving the sign-in.
  }
}
