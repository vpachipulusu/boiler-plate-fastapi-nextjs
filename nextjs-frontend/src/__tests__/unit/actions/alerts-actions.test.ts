// @vitest-environment node
/**
 * the alerts server actions validate input, set the consent wording on the server, and turn every
 * backend outcome into a curated result. The API wrapper is mocked; nothing is sent anywhere.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  confirm: vi.fn(),
  unsubscribe: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.warn, error: mocks.error, info: vi.fn() },
}));
vi.mock('@/lib/api/subscribers', () => ({
  startAlertsSubscription: mocks.start,
  confirmAlertsSubscription: mocks.confirm,
  unsubscribeFromAlertEmails: mocks.unsubscribe,
}));

import {
  confirmAlertsAction,
  subscribeToAlertsAction,
  unsubscribeFromAlertsAction,
} from '@/app/actions/alerts-actions';
import { ALERTS_CONSENT_TEXT } from '@/lib/alerts/consent';
import { ALERTS_FAILURE_MESSAGES } from '@/lib/alerts/outcomes';

const VALID = {
  email: '  sam@example.com ',
  categories: ['beauty', 'pets'],
  frequency: 'weekly',
  consent: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.start.mockResolvedValue({ success: true, data: {} });
  mocks.confirm.mockResolvedValue({ success: true, data: {} });
  mocks.unsubscribe.mockResolvedValue({ success: true, data: {} });
});

describe('subscribeToAlertsAction', () => {
  it('sends the trimmed address, the choices and the server-side consent wording', async () => {
    const result = await subscribeToAlertsAction(VALID);

    expect(result).toEqual({ success: true });
    expect(mocks.start).toHaveBeenCalledWith({
      email: 'sam@example.com',
      categories: ['beauty', 'pets'],
      frequency: 'WEEKLY',
      consent_text: ALERTS_CONSENT_TEXT,
    });
  });

  it('ignores consent wording or a source supplied by the browser', async () => {
    await subscribeToAlertsAction({ ...VALID, consent_text: 'forged', consent_source: 'x' });

    expect(mocks.start.mock.calls[0][0].consent_text).toBe(ALERTS_CONSENT_TEXT);
    expect(mocks.start.mock.calls[0][0]).not.toHaveProperty('consent_source');
  });

  it.each([
    ['no object', null],
    ['bad email', { ...VALID, email: 'nope' }],
    ['empty categories', { ...VALID, categories: [] }],
    ['bad slug', { ...VALID, categories: ['Bad Slug'] }],
    [
      'too many categories',
      { ...VALID, categories: Array.from({ length: 21 }, (_, i) => `c${i}`) },
    ],
    ['unknown frequency', { ...VALID, frequency: 'hourly' }],
    ['no consent', { ...VALID, consent: false }],
    ['overlong email', { ...VALID, email: `${'a'.repeat(250)}@example.com` }],
  ])('refuses %s without calling the backend', async (_name, input) => {
    const result = await subscribeToAlertsAction(input);

    expect(result).toEqual({
      success: false,
      code: 'invalid_input',
      error: ALERTS_FAILURE_MESSAGES.invalid_input,
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rate_limited'],
    [503, 'unavailable'],
    [500, 'unavailable'],
    [422, 'invalid_input'],
    [undefined, 'unavailable'],
  ] as const)('maps backend status %s to the curated "%s" message', async (status, code) => {
    mocks.start.mockResolvedValue({
      success: false,
      error: 'secret backend text for sam@example.com',
      status,
    });

    const result = await subscribeToAlertsAction(VALID);

    expect(result).toEqual({ success: false, code, error: ALERTS_FAILURE_MESSAGES[code] });
    expect(JSON.stringify(result)).not.toMatch(/secret backend text|sam@example/);
  });

  it('answers "unavailable" when the backend is not configured, logging only the error name', async () => {
    mocks.start.mockRejectedValue(new Error('BACKEND_API_URL is not set'));

    const result = await subscribeToAlertsAction(VALID);

    expect(result).toMatchObject({ success: false, code: 'unavailable' });
    expect(JSON.stringify(mocks.error.mock.calls)).not.toMatch(/BACKEND_API_URL|sam@example/);
  });

  it('never logs the address', async () => {
    mocks.start.mockResolvedValue({ success: false, error: 'x', status: 503 });

    await subscribeToAlertsAction(VALID);

    expect(JSON.stringify(mocks.warn.mock.calls)).not.toMatch(/sam@example/);
    expect(mocks.warn).toHaveBeenCalledWith('Alerts request failed', {
      operation: 'subscribe',
      status: 503,
    });
  });
});

describe.each([
  ['confirm', confirmAlertsAction, mocks.confirm],
  ['unsubscribe', unsubscribeFromAlertsAction, mocks.unsubscribe],
] as const)('%s action', (_name, action, backend) => {
  it('passes the token through and reports success', async () => {
    const result = await action('tok.en');

    expect(result).toEqual({ success: true });
    expect(backend).toHaveBeenCalledWith('tok.en');
  });

  it.each([undefined, null, '', 'x'.repeat(513), 42])(
    'refuses the unusable token %j as an invalid link',
    async (token) => {
      const result = await action(token);

      expect(result).toMatchObject({ success: false, code: 'invalid_link' });
      expect(backend).not.toHaveBeenCalled();
    }
  );

  it('shows the curated invalid-link message for a backend 400', async () => {
    backend.mockResolvedValue({ success: false, error: 'Invalid or expired link', status: 400 });

    expect(await action('tok')).toEqual({
      success: false,
      code: 'invalid_link',
      error: ALERTS_FAILURE_MESSAGES.invalid_link,
    });
  });

  it('never logs the token', async () => {
    backend.mockResolvedValue({ success: false, error: 'x', status: 503 });

    await action('very-secret-token');

    expect(JSON.stringify([mocks.warn.mock.calls, mocks.error.mock.calls])).not.toMatch(
      /very-secret-token/
    );
  });
});
