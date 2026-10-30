/** two-factor sign-in: the code step of the login panel, from the first step to the dashboard. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithGitHub: vi.fn(),
  verifyTokenAction: vi.fn(),
  toast: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/firebase/auth-helpers', () => ({
  signInWithEmail: mocks.signInWithEmail,
  signInWithGoogle: mocks.signInWithGoogle,
  signInWithGitHub: mocks.signInWithGitHub,
}));
vi.mock('@/app/actions/auth-actions', () => ({ verifyTokenAction: mocks.verifyTokenAction }));

import { LoginPanel } from '@/components/auth/login-panel';
import { TotpChallengeForm } from '@/components/auth/totp-challenge-form';
import {
  SIGN_IN_RATE_LIMITED_ERROR,
  SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
  TOTP_INVALID_ERROR,
  TOTP_REQUIRED_ERROR,
} from '@/lib/auth/auth-error-messages';

const ID_TOKEN = 'id-token-1';
const CODE = '123456';

const totpRequired = {
  success: false,
  error: TOTP_REQUIRED_ERROR,
  data: { totpRequired: true },
};
const totpInvalid = { success: false, error: TOTP_INVALID_ERROR, data: { totpInvalid: true } };

type User = ReturnType<typeof userEvent.setup>;

async function signInWithPassword(user: User) {
  await user.type(screen.getByLabelText(/email/i), 'a@b.com');
  await user.type(screen.getByLabelText(/^password$/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /^sign in$/i }));
}

/** Gets the panel to the code step. */
async function openCodeStep(user: User) {
  mocks.signInWithEmail.mockResolvedValue({ user: {}, idToken: ID_TOKEN, error: null });
  mocks.verifyTokenAction.mockResolvedValueOnce(totpRequired);
  render(<LoginPanel />);
  await signInWithPassword(user);
  return screen.findByLabelText('Authenticator code');
}

async function submitCode(user: User, code: string) {
  await user.type(screen.getByLabelText('Authenticator code'), code);
  await user.click(screen.getByRole('button', { name: /verify and sign in/i }));
}

describe('two-factor code step', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('opens when the password step answers totpRequired, forwarding the same ID token later', async () => {
    const user = userEvent.setup();

    const field = await openCodeStep(user);

    expect(mocks.verifyTokenAction).toHaveBeenCalledTimes(1);
    expect(mocks.verifyTokenAction).toHaveBeenCalledWith(ID_TOKEN);
    expect(screen.getByRole('heading', { name: /two-factor authentication/i })).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('is an accessible numeric one-time-code field with a visible label and help text', async () => {
    const user = userEvent.setup();

    const field = await openCodeStep(user);

    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveAttribute('autocomplete', 'one-time-code');
    expect(field).toHaveAttribute('maxlength', '6');
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).toHaveAccessibleDescription(/six-digit code from your authenticator app/i);
    expect(field.closest('form')).toHaveAttribute('aria-busy', 'false');
  });

  it('keeps only digits', async () => {
    const user = userEvent.setup();
    const field = await openCodeStep(user);

    await user.type(field, '12a 3-4');

    expect(field).toHaveValue('1234');
  });

  it('signs in with the code and goes to the dashboard', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockResolvedValueOnce({ success: true, data: {} });

    await submitCode(user, CODE);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.verifyTokenAction).toHaveBeenLastCalledWith(ID_TOKEN, CODE);
  });

  it('announces a wrong code, clears the field and lets the person retry', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockResolvedValueOnce(totpInvalid);

    await submitCode(user, '000000');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That code did not work');
    expect(alert).not.toHaveTextContent(TOTP_INVALID_ERROR);
    await waitFor(() => expect(alert).toHaveFocus());
    const field = screen.getByLabelText('Authenticator code');
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/did not work/i);

    mocks.verifyTokenAction.mockResolvedValueOnce({ success: true, data: {} });
    await submitCode(user, CODE);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks for six digits without calling the server for a short code', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);

    await submitCode(user, '123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the six-digit code');
    expect(mocks.verifyTokenAction).toHaveBeenCalledTimes(1);
  });

  it('shows the rate limit message when too many codes were tried', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockResolvedValueOnce({
      success: false,
      error: SIGN_IN_RATE_LIMITED_ERROR,
      data: { rateLimited: true },
    });

    await submitCode(user, CODE);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many attempts');
    expect(alert).toHaveTextContent(/wait a few minutes/i);
    expect(alert).not.toHaveTextContent(SIGN_IN_RATE_LIMITED_ERROR);
  });

  it('names an outage rather than a wrong code', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockResolvedValueOnce({
      success: false,
      error: SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
      data: { serviceUnavailable: true },
    });

    await submitCode(user, CODE);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/sign-in is unavailable right now/i);
    expect(alert).not.toHaveTextContent(/code did not work/i);
  });

  it('points back to the first step when the sign-in is too old to finish', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockResolvedValueOnce({
      success: false,
      error: 'Token verification failed',
    });

    await submitCode(user, CODE);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/timed out.*sign in again/i);
    expect(alert).not.toHaveTextContent(/token/i);
  });

  it('treats a thrown network error as a connection problem, without echoing it', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockRejectedValueOnce(new TypeError(`Failed to fetch ${CODE}`));

    await submitCode(user, CODE);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not reach your app/i);
    expect(alert).not.toHaveTextContent(CODE);
    expect(screen.getByLabelText('Authenticator code')).toHaveValue('');
  });

  it('shows no raw server text for an unknown failure', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockResolvedValueOnce({
      success: false,
      error: 'postgres://user:pw@host/db',
    });

    await submitCode(user, CODE);

    expect(await screen.findByRole('alert')).not.toHaveTextContent(/postgres/);
  });

  it('submits once on a double submit and shows the loading state', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);
    mocks.verifyTokenAction.mockReturnValueOnce(new Promise(() => {}));

    await submitCode(user, CODE);
    const button = await screen.findByRole('button', { name: /verifying/i });
    expect(button).toBeDisabled();
    await user.click(button);
    await user.keyboard('{Enter}');

    // One call for the password step, one for the code.
    expect(mocks.verifyTokenAction).toHaveBeenCalledTimes(2);
    expect(button.closest('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('Back returns to the sign-in form with the email kept', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);

    await user.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(screen.queryByLabelText('Authenticator code')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.com');
    expect(screen.getByLabelText(/email/i)).toBeVisible();
  });

  it('hides the provider buttons and the password form while the code step is open', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);

    expect(screen.getByLabelText(/email/i)).not.toBeVisible();
    expect(screen.getByRole('button', { name: /google/i, hidden: true })).not.toBeVisible();
  });

  it('offers a support link for someone who cannot get a code', async () => {
    const user = userEvent.setup();
    await openCodeStep(user);

    expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute(
      'href',
      '/contact'
    );
  });

  it('opens from a provider sign-in too, with the same ID token', async () => {
    const user = userEvent.setup();
    mocks.signInWithGoogle.mockResolvedValue({ user: {}, idToken: ID_TOKEN, error: null });
    mocks.verifyTokenAction.mockResolvedValueOnce(totpRequired);
    render(<LoginPanel />);

    await user.click(screen.getByRole('button', { name: /google/i }));

    expect(await screen.findByLabelText('Authenticator code')).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    mocks.verifyTokenAction.mockResolvedValueOnce({ success: true, data: {} });
    await submitCode(user, CODE);
    expect(mocks.verifyTokenAction).toHaveBeenLastCalledWith(ID_TOKEN, CODE);
  });
});

describe('TotpChallengeForm', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('calls onSignedIn after a successful code, submitted with Enter, and stays locked', async () => {
    const user = userEvent.setup();
    const onSignedIn = vi.fn();
    mocks.verifyTokenAction.mockResolvedValue({ success: true, data: {} });
    render(<TotpChallengeForm idToken={ID_TOKEN} onSignedIn={onSignedIn} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Authenticator code'), CODE);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(mocks.verifyTokenAction).toHaveBeenCalledWith(ID_TOKEN, CODE);
    expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
  });

  it('calls onCancel from Back', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<TotpChallengeForm idToken={ID_TOKEN} onSignedIn={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
