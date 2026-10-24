// @vitest-environment node
/**
 * The dashboard Overview reads the profile and the plan through the API; an account with no billing
 * organisation is on the free plan. Login history lives on the security page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NO_BILLING_ORGANIZATION_MESSAGE } from '@/lib/api/billing';
import {
  REVOKED_SESSION,
  SESSION_CHECK_DOWN,
  navigationMock,
  redirectTarget,
  rejection,
} from './route-test-helpers';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  fetchSessionStatus: vi.fn(),
  fetchProfile: vi.fn(),
  fetchLoginHistory: vi.fn(),
  fetchBillingSummary: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('next/navigation', () => ({ ...navigationMock, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }));
vi.mock('@/lib/api/billing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/billing')>('@/lib/api/billing');
  return { ...actual, fetchBillingSummary: mocks.fetchBillingSummary };
});
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));
vi.mock('@/components/dashboard/subscription-success-handler', () => ({
  SubscriptionSuccessHandler: () => null,
}));
vi.mock('@/lib/api/account', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/account')>('@/lib/api/account');
  return {
    toProfile: actual.toProfile,
    toLoginHistoryEntry: actual.toLoginHistoryEntry,
    fetchSessionStatus: mocks.fetchSessionStatus,
    fetchProfile: mocks.fetchProfile,
    fetchLoginHistory: mocks.fetchLoginHistory,
  };
});

import DashboardPage from '@/app/dashboard/page';

const PROFILE = {
  id: 'u1',
  email: 'a@b.test',
  email_verified: true,
  display_name: 'Ada',
  bio: null,
  avatar_url: null,
  location: null,
  website: null,
  phone_number: null,
  created_at: '2026-01-01T00:00:00Z',
};
const PRO_PLAN = { key: 'pro', name: 'Pro', max_members: 5 };
// The plan panel shows the plan key capitalised and the status (or renewal date) under it.
const PLAN_ELEMENT = (plan: string) => `<p class="text-sm font-medium capitalize">${plan} plan</p>`;
const STATUS_ELEMENT = (status: string) =>
  `<p class="text-[0.8125rem] text-muted-foreground">${status}</p>`;
const page = () => DashboardPage();
const render = async () => renderToStaticMarkup((await page()) as React.ReactElement);

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGet.mockReturnValue({ value: 'cookie-value' });
    mocks.fetchSessionStatus.mockResolvedValue({
      success: true,
      data: { uid: 'uid-1', email_verified: true },
    });
    mocks.fetchProfile.mockResolvedValue({ success: true, data: PROFILE });
    mocks.fetchBillingSummary.mockResolvedValue({
      success: true,
      data: {
        plan: PRO_PLAN,
        subscription_status: 'active',
        current_period_end: '2027-01-01T00:00:00Z',
        has_billing_account: true,
        has_subscription: true,
        cancel_at_period_end: false,
        interval: 'monthly',
      },
    });
  });

  it('redirects to /login with no session cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    expect(redirectTarget(await rejection(page()))).toBe('/login');
  });

  it('renders from the API data and no longer loads the login history', async () => {
    const tree = await page();

    expect(tree).toBeDefined();
    expect(mocks.fetchLoginHistory).not.toHaveBeenCalled();
    expect(mocks.fetchBillingSummary).toHaveBeenCalledTimes(1);
  });

  describe('overview layout', () => {
    it('has exactly one h1, greeting the user by display name', async () => {
      const markup = await render();

      expect(markup.match(/<h1/g)).toHaveLength(1);
      expect(markup).toContain('Welcome back, Ada');
    });

    it('falls back to the email when there is no display name', async () => {
      mocks.fetchProfile.mockResolvedValue({
        success: true,
        data: { ...PROFILE, display_name: null },
      });

      expect(await render()).toContain('Welcome back, a@b.test');
    });

    it('links to Profile, Security and Settings and to the pricing page', async () => {
      const markup = await render();

      expect(markup).toContain('href="/dashboard/profile"');
      expect(markup).toContain('href="/dashboard/security"');
      expect(markup).toContain('href="/dashboard/settings"');
      expect(markup).toContain('Compare plans');
    });

    it('does not nest a bordered panel inside another', async () => {
      const markup = await render();

      expect(markup).not.toContain('theme-card');
    });
  });

  it('shows the plan and status read from the billing API', async () => {
    const markup = await render();

    expect(markup).toContain(PLAN_ELEMENT('pro'));
    expect(markup).not.toContain(PLAN_ELEMENT('free'));
    expect(markup).toContain('Active until');
  });

  describe('plan status line', () => {
    const PERIOD_END = '2027-01-01T00:00:00Z';
    const DATE = new Date(PERIOD_END).toLocaleDateString();
    const summary = (
      status: string,
      overrides: { planKey?: string; hasSubscription?: boolean; periodEnd?: string | null } = {}
    ) => ({
      success: true,
      data: {
        plan: { ...PRO_PLAN, key: overrides.planKey ?? 'pro' },
        subscription_status: status,
        current_period_end: 'periodEnd' in overrides ? overrides.periodEnd : PERIOD_END,
        has_billing_account: overrides.hasSubscription ?? true,
        has_subscription: overrides.hasSubscription ?? true,
        cancel_at_period_end: false,
        interval: 'monthly',
      },
    });

    // Every backend subscription_status value; the label never shows the raw value.
    it.each([
      ['active', `Active until ${DATE}`],
      ['trialing', `Trial ends ${DATE}`],
      ['past_due', 'Payment past due'],
      ['inactive', 'Inactive'],
      ['canceled', 'Canceled'],
      ['unpaid', 'Unpaid'],
      ['incomplete', 'Incomplete'],
      ['incomplete_expired', 'Incomplete expired'],
      ['paused', 'Paused'],
    ])('shows %s as "%s" on the plan panel', async (status, label) => {
      mocks.fetchBillingSummary.mockResolvedValue(summary(status));

      const markup = await render();

      expect(markup).toContain(PLAN_ELEMENT('pro'));
      expect(markup).toContain(STATUS_ELEMENT(label));
      expect(markup).not.toContain(STATUS_ELEMENT(status));
    });

    it.each([
      ['active', 'Active'],
      ['trialing', 'Trial'],
    ])('drops the date for %s when the period end is unknown', async (status, label) => {
      mocks.fetchBillingSummary.mockResolvedValue(summary(status, { periodEnd: null }));

      const markup = await render();

      expect(markup).toContain(STATUS_ELEMENT(label));
      expect(markup).not.toContain('Invalid Date');
    });

    it('shows an admin-granted plan (paid plan, status inactive, no subscription) as granted', async () => {
      mocks.fetchBillingSummary.mockResolvedValue(
        summary('inactive', { planKey: 'enterprise', hasSubscription: false, periodEnd: null })
      );

      const markup = await render();

      expect(markup).toContain(PLAN_ELEMENT('enterprise'));
      expect(markup).toContain(STATUS_ELEMENT('Granted by admin'));
      expect(markup).not.toContain(STATUS_ELEMENT('inactive'));
    });

    it('does not call a paid plan with no subscription "granted" unless its status is inactive', async () => {
      mocks.fetchBillingSummary.mockResolvedValue(
        summary('canceled', { hasSubscription: false, periodEnd: null })
      );

      const markup = await render();

      expect(markup).toContain(STATUS_ELEMENT('Canceled'));
      expect(markup).not.toContain('Granted by admin');
    });

    it('humanises a status value the dashboard does not know yet', async () => {
      mocks.fetchBillingSummary.mockResolvedValue(summary('some_new_state'));

      expect(await render()).toContain(STATUS_ELEMENT('Some new state'));
    });
  });

  it('treats an account with no billing organisation as free instead of failing', async () => {
    mocks.fetchBillingSummary.mockResolvedValue({
      success: false,
      error: NO_BILLING_ORGANIZATION_MESSAGE,
    });

    const markup = await render();

    expect(markup).toContain(PLAN_ELEMENT('free'));
    expect(markup).not.toContain(PLAN_ELEMENT('pro'));
    expect(markup).not.toContain('Active until');
    expect(markup).toContain(STATUS_ELEMENT('Inactive'));
  });

  it('clears the session when the billing call finds it rejected', async () => {
    mocks.fetchBillingSummary.mockResolvedValue({
      success: false,
      error: 'Invalid authentication',
      status: 401,
    });

    expect(redirectTarget(await rejection(page()))).toBe('/api/auth/clear-session');
  });

  it('keeps the session when only the billing organisation is gone (billing 404)', async () => {
    mocks.fetchBillingSummary.mockResolvedValue({
      success: false,
      error: 'Request failed',
      status: 404,
    });

    const error = await rejection(page());

    expect(navigationMock.redirect).not.toHaveBeenCalled();
    expect(String(error)).toContain('404');
  });

  it('does not render an invalid date when the period end is empty', async () => {
    mocks.fetchBillingSummary.mockResolvedValue({
      success: true,
      data: {
        plan: PRO_PLAN,
        subscription_status: 'active',
        current_period_end: null,
        has_billing_account: true,
        has_subscription: true,
        cancel_at_period_end: false,
        interval: 'monthly',
      },
    });

    expect(await render()).not.toContain('Invalid Date');
  });

  it.each([
    [{ success: false, error: 'Backend unavailable' }, 'unreachable'],
    [{ success: false, error: 'Request failed', status: 500 }, '500'],
  ])(
    'rethrows when the billing API is down (%o) instead of showing a wrong plan',
    async (failure, detail) => {
      mocks.fetchBillingSummary.mockResolvedValue(failure);

      const error = await rejection(page());

      expect(String(error)).toContain(detail);
      expect(navigationMock.redirect).not.toHaveBeenCalled();
    }
  );

  it('sends an unverified user to /verify-email', async () => {
    mocks.fetchSessionStatus.mockResolvedValue({
      success: true,
      data: { uid: 'uid-1', email_verified: false },
    });

    expect(redirectTarget(await rejection(page()))).toBe('/verify-email');
  });

  it.each([
    [401, 'Invalid authentication'],
    [404, 'Not found'],
  ])('clears the session when the backend answers %s', async (status, error) => {
    mocks.fetchProfile.mockResolvedValue({ success: false, error, status });

    expect(redirectTarget(await rejection(page()))).toBe('/api/auth/clear-session');
  });

  it('clears the session when the backend reports the session revoked (401 Invalid authentication)', async () => {
    mocks.fetchSessionStatus.mockResolvedValue(REVOKED_SESSION);

    expect(redirectTarget(await rejection(page()))).toBe('/api/auth/clear-session');
    expect(mocks.fetchProfile).not.toHaveBeenCalled();
  });

  it('keeps the session and rethrows when the session check is down', async () => {
    mocks.fetchSessionStatus.mockResolvedValue(SESSION_CHECK_DOWN);

    const error = await rejection(page());

    expect((error as Error).message).toBe('Session status check failed');
    expect(navigationMock.redirect).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ success: false, error: 'Backend unavailable' }, 'unreachable'],
    [{ success: false, error: 'Unauthorized', status: 401 }, '401'],
    [{ success: false, error: 'Request failed', status: 500 }, '500'],
  ])('keeps the session and rethrows on an outage (%o)', async (failure, detail) => {
    mocks.fetchProfile.mockResolvedValue(failure);

    const error = await rejection(page());

    expect(navigationMock.redirect).not.toHaveBeenCalled();
    expect(String(error)).toContain(detail);
    expect(mocks.loggerError).toHaveBeenCalledTimes(1);
  });
});
