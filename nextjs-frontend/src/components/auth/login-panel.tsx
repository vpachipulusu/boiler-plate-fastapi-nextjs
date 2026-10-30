'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthDivider } from '@/app/(auth)/_components/auth-shared';
import type { AuthFormError } from './auth-form-errors';
import { LoginForm } from './login-form';
import { OAuthButtons } from './oauth-buttons';
import { TotpChallengeForm } from './totp-challenge-form';
import { useCompleteSignIn } from './use-complete-sign-in';

/**
 * The sign-in area: provider buttons and the email form, plus the two-factor code step they both hand over to
 * when the account has 2FA on. The first step stays mounted (hidden) during the code step so the typed email
 * survives "Back to sign in".
 */
export function LoginPanel() {
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthFormError | null>(null);
  const completeSignIn = useCompleteSignIn();
  const stepOneRef = useRef<HTMLDivElement>(null);
  const wasInCodeStep = useRef(false);

  // Back from the code step: the form was hidden, so put the cursor on the password (the email is kept).
  useEffect(() => {
    if (wasInCodeStep.current && challengeToken === null) {
      stepOneRef.current?.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
    }
    wasInCodeStep.current = challengeToken !== null;
  }, [challengeToken]);

  function leaveCodeStep(message?: AuthFormError) {
    setNotice(message ?? null);
    setChallengeToken(null);
  }

  function startCodeStep(idToken: string) {
    setNotice(null);
    setChallengeToken(idToken);
  }

  return (
    <>
      {challengeToken !== null && (
        <TotpChallengeForm
          idToken={challengeToken}
          onSignedIn={completeSignIn}
          onCancel={leaveCodeStep}
        />
      )}
      <div ref={stepOneRef} className="space-y-4" hidden={challengeToken !== null}>
        <OAuthButtons onTotpRequired={startCodeStep} />
        <AuthDivider>Or continue with email</AuthDivider>
        <LoginForm onTotpRequired={startCodeStep} notice={notice} />
      </div>
    </>
  );
}
