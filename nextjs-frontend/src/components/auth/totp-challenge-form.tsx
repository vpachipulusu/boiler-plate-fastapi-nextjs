'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { verifyTokenAction } from '@/app/actions/auth-actions';
import { AuthFormAlert } from './auth-form-alert';
import {
  classifyThrownAuthError,
  classifyTotpResult,
  REDIRECT_RECOVERY_MS,
  type AuthFormError,
} from './auth-form-errors';
import { TwoFactorCodeField } from './two-factor-code-field';

const CODE_FIELD_ID = 'sign-in-totp-code';
const HELP_ID = 'sign-in-totp-help';
const ERROR_ID = 'sign-in-totp-error';
const CODE_PATTERN = /^\d{6}$/;

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
  /** Back to the first step (to start the sign-in again). */
  onCancel: () => void;
}

/**
 * Second sign-in step for an account with two-factor authentication: the six-digit authenticator code, sent
 * with the same ID token to `verifyTokenAction`. Errors use the curated alert copy and are announced; the code
 * itself is never logged and is cleared after every refusal.
 */
export function TotpChallengeForm({ idToken, onSignedIn, onCancel }: TotpChallengeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<AuthFormError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isSubmitting = useRef(false);

  // A new step: put the cursor where the person types.
  useEffect(() => {
    document.getElementById(CODE_FIELD_ID)?.focus();
  }, []);

  function release() {
    isSubmitting.current = false;
    setIsLoading(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting.current) return;
    if (!CODE_PATTERN.test(code)) {
      setError(INCOMPLETE_CODE);
      return;
    }
    isSubmitting.current = true;
    let signedIn = false;
    try {
      setIsLoading(true);
      setError(null);

      const result = await verifyTokenAction(idToken, code);
      if (!result.success) {
        setCode('');
        setError(classifyTotpResult(result));
        return;
      }

      signedIn = true;
      // If navigation fails or stalls, give the form back instead of leaving it locked.
      setTimeout(release, REDIRECT_RECOVERY_MS);
      onSignedIn();
    } catch (thrown) {
      signedIn = false;
      setCode('');
      setError(classifyThrownAuthError(thrown, 'sign-in'));
    } finally {
      // Stay locked while the redirect is in flight so a second submit cannot run.
      if (!signedIn) release();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={isLoading}>
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold">Two-factor authentication</h2>
        <p id={HELP_ID} className="text-sm text-muted-foreground">
          Enter the six-digit code from your authenticator app to finish signing in.
        </p>
      </div>

      {error && <AuthFormAlert error={error} id={ERROR_ID} />}

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
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
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
