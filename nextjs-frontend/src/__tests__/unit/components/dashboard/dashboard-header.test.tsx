/** FREEJ-41: the account menu shows an Admin link only for an account the backend profile marks as admin. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/app/actions/auth-actions', () => ({ logoutAction: vi.fn() }));

import { DashboardHeader } from '@/components/dashboard/dashboard-header';

const base = { email: 'ada@example.com', dbDisplayName: 'Ada', dbAvatarUrl: null };

async function openMenu() {
  await userEvent.setup().click(screen.getByRole('button'));
}

describe('DashboardHeader account menu', () => {
  it('links to /admin for an admin', async () => {
    render(<DashboardHeader user={{ ...base, isAdmin: true }} />);
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin'
    );
  });

  it.each([[{}], [{ isAdmin: false }]])('has no Admin link for %j', async (extra) => {
    render(<DashboardHeader user={{ ...base, ...extra }} />);
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: /profile/i })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });
});
