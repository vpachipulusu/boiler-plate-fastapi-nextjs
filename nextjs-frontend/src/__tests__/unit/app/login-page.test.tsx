/** FREEJ-41: the login page reads ?redirect= on the server and hands the panel a safe path. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/auth/login-panel', () => ({
  LoginPanel: ({ redirectTo }: { redirectTo?: string }) => (
    <div data-testid="panel" data-redirect={redirectTo} />
  ),
}));

import LoginPage from '@/app/(auth)/login/page';

async function renderWith(redirect: string | string[] | undefined) {
  render(await LoginPage({ searchParams: Promise.resolve({ redirect }) }));
  return screen.getByTestId('panel').getAttribute('data-redirect');
}

describe('LoginPage ?redirect=', () => {
  it('passes a path on this site through', async () => {
    expect(await renderWith('/admin')).toBe('/admin');
  });

  it('defaults to /dashboard without a value', async () => {
    expect(await renderWith(undefined)).toBe('/dashboard');
  });

  it.each(['//evil.com', 'https://evil.com', '/login', '/api/auth/clear-session', ''])(
    'falls back to /dashboard for %j',
    async (unsafe) => {
      expect(await renderWith(unsafe)).toBe('/dashboard');
    }
  );

  it('falls back to /dashboard for a repeated parameter', async () => {
    expect(await renderWith(['/admin', '/dashboard'])).toBe('/dashboard');
  });
});
