'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { verifyTokenAction } from '@/app/actions/auth-actions';
import { totpCodeSchema } from '@/lib/utils/validation';
import { AuthFormAlert } from './auth-form-alert';
import {
  classifyThrownAuthError,
  classifyTotpResult,
  REDIRECT_RECOVERY_MS,
  SIGN_IN_TIMED_OUT,
  type AuthFormError,
} from './auth-form-errors';
import { signOutQuietly } from './sign-out-quietly';
import { TwoFactorCodeField } from './two-factor-code-field';

const CODE_FIELD_ID = 'sign-in-totp-code';
const HELP_ID = 'sign-in-totp-help';
const ERROR_ID = 'sign-in-totp-error';

const INCOMPLETE_CODE: AuthFormError = {
  kind: 'totp-invalid',
  title: 'Enter the six-digit code',
  message: 'The code in your authenticator app has six digits, for example 123456.',
};

interface TotpChallengeFormProps {
  /** The Firebase ID token from the first step. It is only forwarded to the server action, never stored or logged. */
  idToken: string;
  /** Called once the session cookie is set. */
  onSignedIn: () => void;
  /**
   * Back to the first step (to start the sign-in again), with an optional notice for it to show. The Firebase
   * client has been signed out by then.
   */
  onCancel: (notice?: AuthFormError) => void;
}

/**
 * Second sign-in step for an account with two-factor authentication: the six-digit authenticator code, sent
 * with the same ID token to `verifyTokenAction`. Errors use the curated alert copy and are announced; the code
 * itself is never logged and is cleared after every refusal.
 *
 * Leaving the step without signing in (Back, a sign-in too old to finish, the page going away) signs the Firebase
 * client out, so an abandoned sign-in leaves no refresh token behind.
 */
export function TotpChallengeForm({ idToken, onSignedIn, onCancel }: TotpChallengeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<AuthFormError | null>(null);
  // Bumped on every error so an identical one is announced again (the alert is remounted).
  const [errorKey, setErrorKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const isSubmitting = useRef(false);
  const signedIn = useRef(false);
  const signedOut = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const signOutOnce = useCallback(async () => {
    if (signedOut.current) return;
    signedOut.current = true;
    await signOutQuietly();
  }, []);

  // Unmounting without a successful sign-in abandons it. React StrictMode (dev) runs mount, a simulated unmount and
  // mount again, so the check is deferred: an immediate remount cancels it and only a real unmount signs out.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(redirectTimer.current);
      setTimeout(() => {
        if (!mounted.current && !signedIn.current) void signOutOnce();
      }, 0);
    };
  }, [signOutOnce]);

  // A new step, and after each error: the cursor goes where the person types (this also keeps a phone keypad open).
  useEffect(() => {
    if (!isLoading) document.getElementById(CODE_FIELD_ID)?.focus();
  }, [error, isLoading]);

  function release() {
    isSubmitting.current = false;
    setIsLoading(false);
  }

  function showError(next: AuthFormError) {
    setError({ ...next });
    setErrorKey((key) => key + 1);
  }

  async function leave(notice?: AuthFormError) {
    // Once the session cookie is set the sign-in succeeded (even if the redirect stalled): keep the Firebase user.
    if (!signedIn.current) await signOutOnce();
    onCancel(notice);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // After a success the code is spent: a stalled redirect must not resend it.
    if (isSubmitting.current || signedIn.current) return;
    if (!totpCodeSchema.safeParse(code).success) {
      showError(INCOMPLETE_CODE);
      return;
    }
    isSubmitting.current = true;
    let done = false;
    try {
      setIsLoading(true);
      setError(null);

      const result = await verifyTokenAction(idToken, code);
      if (!result.success) {
        const failure = classifyTotpResult(result);
        if (failure.kind === 'totp-expired') {
          // The first sign-in is too old to finish: every retry would fail and still count against the sign-in limit.
          done = true;
          await leave(SIGN_IN_TIMED_OUT);
          return;
        }
        setCode('');
        showError(failure);
        return;
      }

      signedIn.current = true;
      done = true;
      // If navigation fails or stalls, give the form back instead of leaving it locked.
      redirectTimer.current = setTimeout(release, REDIRECT_RECOVERY_MS);
      onSignedIn();
    } catch (thrown) {
      setCode('');
      showError(classifyThrownAuthError(thrown, 'sign-in'));
    } finally {
      // Stay locked while the redirect is in flight (or the step is closing) so a second submit cannot run.
      if (!done) release();
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={isLoading}>
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold">Two-factor authentication</h2>
        <p id={HELP_ID} className="text-sm text-muted-foreground">
          Enter the six-digit code from your authenticator app to finish signing in.
        </p>
      </div>

      {error && <AuthFormAlert key={errorKey} error={error} id={ERROR_ID} focusOnShow={false} />}

      <TwoFactorCodeField
        id={CODE_FIELD_ID}
        label="Authenticator code"
        value={code}
        onChange={setCode}
        disabled={isLoading}
        describedBy={error ? `${HELP_ID} ${ERROR_ID}` : HELP_ID}
        invalid={error !== null}
      />

      <Button type="submit" variant="accent" className="w-full" disabled={isLoading}>
        {isLoading ? 'Verifying...' : 'Verify and sign in'}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => void leave()} disabled={isLoading}>
          Back to sign in
        </Button>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
        >
          Cannot get a code? Contact support
        </Link>
      </div>
    </form>
  );
}
