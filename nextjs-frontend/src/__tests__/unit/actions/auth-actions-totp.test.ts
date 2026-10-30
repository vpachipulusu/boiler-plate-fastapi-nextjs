// @vitest-environment node
/**
 * Two-factor sign-in through the server action: the first call answers `totpRequired`, the second carries the
 * six-digit code. Only curated text and typed flags reach the browser, and a code is never logged.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIGN_IN_RATE_LIMITED_ERROR,
  SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
  TOTP_INVALID_ERROR,
  TOTP_REQUIRED_ERROR,
} from '@/lib/auth/auth-error-messages';

const mocks = vi.hoisted(() => ({
  verifyBackendIdToken: vi.fn(),
  createBackendSession: vi.fn(),
  refreshBackendSession: vi.fn(),
  readSessionStatus: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'vitest' }),
  cookies: async () => ({
    set: mocks.cookieSet,
    get: mocks.cookieGet,
    delete: mocks.cookieDelete,
  }),
}));
vi.mock('@/lib/firebase/client', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ applyActionCode: vi.fn() }));
vi.mock('@/lib/api/account', () => ({
  createBackendSession: mocks.createBackendSession,
  refreshBackendSession: mocks.refreshBackendSession,
  verifyBackendIdToken: mocks.verifyBackendIdToken,
  revokeBackendSession: vi.fn(),
  fetchProfile: vi.fn(),
  fetchSettings: vi.fn(),
  toSettings: (settings: unknown) => settings,
}));
vi.mock('@/lib/auth/verified-session', () => ({
  isEmailNotVerifiedError: () => false,
  verifyVerifiedSessionCookie: vi.fn(),
  readSessionStatus: (...args: unknown[]) => mocks.readSessionStatus(...args),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.logInfo, warn: mocks.logWarn, error: mocks.logError },
}));

import { refreshSessionAction, verifyTokenAction } from '@/app/actions/auth-actions';

const CODE = '123456';

const totpRequired = {
  success: false,
  error: 'Two-factor code required (backend wording)',
  status: 401,
  code: 'totp_required',
};
const totpInvalid = {
  success: false,
  error: 'Invalid two-factor code',
  status: 401,
  code: 'totp_invalid',
};

describe('verifyTokenAction two-factor step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyBackendIdToken.mockResolvedValue({
      success: true,
      data: { uid: 'uid-1', email: 'user@example.test', email_verified: true },
    });
    mocks.createBackendSession.mockResolvedValue({
      success: true,
      data: { session_cookie: 'backend-session-cookie', expires_in: 432000 },
    });
    mocks.cookieGet.mockReturnValue(undefined);
  });

  it('answers totpRequired, with curated text only, when the API wants a code', async () => {
    mocks.createBackendSession.mockResolvedValue(totpRequired);

    const result = await verifyTokenAction('id-token');

    expect(result).toEqual({
      success: false,
      error: TOTP_REQUIRED_ERROR,
      data: { totpRequired: true },
    });
    expect(JSON.stringify(result)).not.toContain('backend wording');
    expect(mocks.createBackendSession).toHaveBeenCalledWith('id-token', 'vitest');
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.logError).not.toHaveBeenCalled();
    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it('sends the code to the API with the same token and sets the cookie on success', async () => {
    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({ success: true, data: { claimsEmailVerified: true } });
    expect(mocks.createBackendSession).toHaveBeenCalledWith('id-token', 'vitest', CODE);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'session',
      'backend-session-cookie',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 432000 })
    );
  });

  it('answers totpInvalid for a wrong code and sets no cookie', async () => {
    mocks.createBackendSession.mockResolvedValue(totpInvalid);

    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({
      success: false,
      error: TOTP_INVALID_ERROR,
      data: { totpInvalid: true },
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it.each(['12345', '1234567', 'abcdef', '12 456', ' 123456', '123456\n', ''])(
    'refuses the malformed code %j without calling the API',
    async (code) => {
      const result = await verifyTokenAction('id-token', code);

      expect(result).toEqual({
        success: false,
        error: TOTP_INVALID_ERROR,
        data: { totpInvalid: true },
      });
      expect(mocks.verifyBackendIdToken).not.toHaveBeenCalled();
      expect(mocks.createBackendSession).not.toHaveBeenCalled();
    }
  );

  it('treats a code that is not a string as no code', async () => {
    const call = verifyTokenAction as unknown as (token: string, code: unknown) => Promise<unknown>;

    await call('id-token', { code: CODE });

    expect(mocks.createBackendSession).toHaveBeenCalledWith('id-token', 'vitest');
  });

  it('reports a rate limit when the API answers 429 and sets no cookie', async () => {
    mocks.createBackendSession.mockResolvedValue({
      success: false,
      error: 'Too many requests',
      status: 429,
    });

    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({
      success: false,
      error: SIGN_IN_RATE_LIMITED_ERROR,
      data: { rateLimited: true },
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it.each([503, undefined])('reports an outage when the API answers %s', async (status) => {
    mocks.createBackendSession.mockResolvedValue({ success: false, error: 'down', status });

    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({
      success: false,
      error: SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
      data: { serviceUnavailable: true },
    });
  });

  it('reports an outage when the call throws a network error', async () => {
    mocks.createBackendSession.mockRejectedValue(
      Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' })
    );

    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({
      success: false,
      error: SIGN_IN_SERVICE_UNAVAILABLE_ERROR,
      data: { serviceUnavailable: true },
    });
  });

  it('keeps a 401 without a two-factor code generic (a sign-in that is too old)', async () => {
    mocks.createBackendSession.mockResolvedValue({
      success: false,
      error: 'Invalid authentication',
      status: 401,
    });

    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({ success: false, error: 'Token verification failed' });
  });

  it('does not treat a two-factor code on a non-401 answer as a code refusal', async () => {
    mocks.createBackendSession.mockResolvedValue({ ...totpInvalid, status: 409 });

    const result = await verifyTokenAction('id-token', CODE);

    expect(result).toEqual({ success: false, error: 'Token verification failed' });
  });

  it('never logs the code, the token or backend text', async () => {
    mocks.createBackendSession.mockResolvedValue(totpInvalid);

    await verifyTokenAction('secret-id-token', CODE);
    mocks.createBackendSession.mockResolvedValue({ success: false, error: 'x', status: 500 });
    await verifyTokenAction('secret-id-token', CODE);

    const logged = JSON.stringify([
      mocks.logInfo.mock.calls,
      mocks.logWarn.mock.calls,
      mocks.logError.mock.calls,
    ]);
    expect(logged).not.toContain(CODE);
    expect(logged).not.toContain('secret-id-token');
    expect(mocks.logWarn).toHaveBeenCalledWith('Sign-in refused:', {
      status: 401,
      code: 'totp_invalid',
    });
  });

  it('leaves the refresh path alone: a two-factor answer on a refresh is not a challenge', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'session-cookie' });
    mocks.readSessionStatus.mockResolvedValue({ uid: 'uid-1' });
    mocks.refreshBackendSession.mockResolvedValue(totpRequired);

    const result = await refreshSessionAction('id-token');

    expect(result).toEqual({
      success: false,
      error: 'Token verification failed',
      data: { signInRequired: true },
    });
    expect(mocks.createBackendSession).not.toHaveBeenCalled();
  });
});
