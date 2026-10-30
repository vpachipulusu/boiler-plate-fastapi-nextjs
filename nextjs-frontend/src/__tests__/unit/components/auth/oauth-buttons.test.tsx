/** an outage during OAuth sign-in is not reported as a refused sign-in. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SIGN_IN_SERVICE_UNAVAILABLE_ERROR } from '@/lib/auth/auth-error-messages';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  verifyTokenAction: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithGitHub: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/app/actions/auth-actions', () => ({ verifyTokenAction: mocks.verifyTokenAction }));
vi.mock('@/lib/firebase/auth-helpers', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
  signInWithGitHub: mocks.signInWithGitHub,
  signOut: mocks.signOut,
}));

import { OAuthButtons } from '@/components/auth/oauth-buttons';

describe('OAuthButtons verification failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.signInWithGoogle.mockResolvedValue({ user: { uid: 'u' }, idToken: 'tok' });
    mocks.signInWithGitHub.mockResolvedValue({ user: { uid: 'u' }, idToken: 'tok' });
  });

  it.each(['Google', 'GitHub'])(
    '%s names a service outage instead of "Authentication Failed"',
    async (provider) => {
      mocks.verifyTokenAction.mockResolvedValue({
        success: false,
        error: SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
        data: { serviceUnavailable: true },
      });
      render(<OAuthButtons />);

      fireEvent.click(screen.getByRole('button', { name: new RegExp(provider, 'i') }));

      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      const toast = mocks.toast.mock.calls[0][0];
      expect(toast.title).toBe('Sign-in is unavailable right now');
      expect(JSON.stringify(toast)).not.toMatch(/Authentication Failed|token/i);
    }
  );

  it.each(['Google', 'GitHub'])(
    '%s does not treat the outage text without the typed flag as an outage',
    async (provider) => {
      mocks.verifyTokenAction.mockResolvedValue({
        success: false,
        error: SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
      });
      render(<OAuthButtons />);

      fireEvent.click(screen.getByRole('button', { name: new RegExp(provider, 'i') }));

      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      expect(mocks.toast.mock.calls[0][0].title).toBe('Authentication Failed');
    }
  );

  it('keeps "Authentication Failed" when the token is refused', async () => {
    mocks.verifyTokenAction.mockResolvedValue({
      success: false,
      error: 'Token verification failed',
    });
    render(<OAuthButtons />);

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0].title).toBe('Authentication Failed');
  });

  it.each(['Google', 'GitHub'])(
    '%s hands the ID token to the two-factor step when the account needs a code',
    async (provider) => {
      const onTotpRequired = vi.fn();
      mocks.verifyTokenAction.mockResolvedValue({
        success: false,
        error: 'Two-factor code required',
        data: { totpRequired: true },
      });
      render(<OAuthButtons onTotpRequired={onTotpRequired} />);

      fireEvent.click(screen.getByRole('button', { name: new RegExp(provider, 'i') }));

      await waitFor(() => expect(onTotpRequired).toHaveBeenCalledWith('tok'));
      expect(mocks.toast).not.toHaveBeenCalled();
    }
  );

  it('points to the login page for the code when the page has no code step', async () => {
    mocks.verifyTokenAction.mockResolvedValue({
      success: false,
      error: 'Two-factor code required',
      data: { totpRequired: true },
    });
    render(<OAuthButtons />);

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const toast = mocks.toast.mock.calls[0][0];
    expect(toast.title).toBe('Two-factor code needed');
    expect(toast.description).toMatch(/login page/i);
    // The half-finished sign-in must not leave the browser signed in to Firebase.
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not sign out when the code step takes over', async () => {
    mocks.verifyTokenAction.mockResolvedValue({
      success: false,
      error: 'Two-factor code required',
      data: { totpRequired: true },
    });
    const onTotpRequired = vi.fn();
    render(<OAuthButtons onTotpRequired={onTotpRequired} />);

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => expect(onTotpRequired).toHaveBeenCalled());
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('names a rate limit instead of "Authentication Failed"', async () => {
    mocks.verifyTokenAction.mockResolvedValue({
      success: false,
      error: 'Too many sign-in attempts',
      data: { rateLimited: true },
    });
    render(<OAuthButtons />);

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const toast = mocks.toast.mock.calls[0][0];
    expect(toast.title).toBe('Too many attempts');
    expect(toast.description).toMatch(/wait a few minutes/i);
    expect(toast.description).not.toMatch(/reset your password/i);
  });
});
