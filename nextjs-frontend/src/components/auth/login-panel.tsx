'use client';

import { useState } from 'react';
import { AuthDivider } from '@/app/(auth)/_components/auth-shared';
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
  const completeSignIn = useCompleteSignIn();

  return (
    <>
      {challengeToken !== null && (
        <TotpChallengeForm
          idToken={challengeToken}
          onSignedIn={completeSignIn}
          onCancel={() => setChallengeToken(null)}
        />
      )}
      <div className="space-y-4" hidden={challengeToken !== null}>
        <OAuthButtons onTotpRequired={setChallengeToken} />
        <AuthDivider>Or continue with email</AuthDivider>
        <LoginForm onTotpRequired={setChallengeToken} />
      </div>
    </>
  );
}
