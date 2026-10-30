// @vitest-environment node
/**
 * the admin user actions run through the admin users API wrapper. They validate input
 * before any call, answer failures with curated messages, and never return backend error text.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'SECRET-sk_live_abc123 postgres://user:pw@host/db';

const mocks = vi.hoisted(() => ({
  fetchAdminUsers: vi.fn(),
  fetchAdminUser: vi.fn(),
  patchAdminUser: vi.fn(),
  removeAdminUser: vi.fn(),
  grantAdminRole: vi.fn(),
  revokeAdminRole: vi.fn(),
  banAdminUser: vi.fn(),
  unbanAdminUser: vi.fn(),
  logError: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/api/admin-guard', () => ({ requireAdminSession: mocks.requireAdminSession }));

vi.mock('@/lib/api/admin-users', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/admin-users')>('@/lib/api/admin-users');
  return { ...actual, ...mocks };
});
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: mocks.logError },
}));

import {
  banUserAction,
  deleteUserAction,
  getAllUsersAction,
  getUserByIdAction,
  grantAdminRoleAction,
  revokeAdminRoleAction,
  unbanUserAction,
  updateUserAction,
} from '@/app/actions/admin/user-actions';

const SUMMARY = {
  id: 'user-1',
  email: 'a@b.test',
  email_verified: true,
  display_name: 'Ada',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
  is_admin: false,
  admin_role: null,
};
const DETAIL = {
  ...SUMMARY,
  bio: null,
  location: null,
  website: null,
  phone_number: null,
  two_factor_enabled: false,
  admin_permissions: [],
};

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (status?: number) => ({ success: false as const, error: SECRET, status });

describe('admin user actions (API-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ ok: true });
  });

  it('getAllUsersAction maps users and computes pagination from the offset', async () => {
    mocks.fetchAdminUsers.mockResolvedValue(
      ok({ users: [SUMMARY], total_count: 45, limit: 20, offset: 20 })
    );

    const result = await getAllUsersAction(2, 20, { search: 'ada' });

    expect(mocks.fetchAdminUsers).toHaveBeenCalledWith({ search: 'ada', limit: 20, offset: 20 });
    expect(result.data.users[0]).toMatchObject({ id: 'user-1', emailVerified: true });
    expect(result.data.pagination).toEqual({ page: 2, limit: 20, totalCount: 45, totalPages: 3 });
  });

  it('getAllUsersAction clamps the page size', async () => {
    mocks.fetchAdminUsers.mockResolvedValue(
      ok({ users: [], total_count: 0, limit: 100, offset: 0 })
    );

    await getAllUsersAction(1, 10_000);

    expect(mocks.fetchAdminUsers.mock.calls[0][0].limit).toBe(100);
  });

  it('getUserByIdAction returns the mapped detail', async () => {
    mocks.fetchAdminUser.mockResolvedValue(ok(DETAIL));

    const result = await getUserByIdAction('user-1');

    expect(result.success).toBe(true);
    expect(result.data.user).toMatchObject({ id: 'user-1', twoFactorEnabled: false });
  });

  it('updateUserAction sends only the provided profile fields in API naming', async () => {
    mocks.patchAdminUser.mockResolvedValue(ok(DETAIL));

    const result = await updateUserAction('user-1', { displayName: 'Ada L', bio: null });

    expect(mocks.patchAdminUser).toHaveBeenCalledWith('user-1', {
      display_name: 'Ada L',
      bio: null,
    });
    expect(result.success).toBe(true);
  });

  it('grantAdminRoleAction rejects an unknown role before calling the API', async () => {
    const result = await grantAdminRoleAction('user-1', {
      role: 'owner' as never,
      permissions: [],
    });

    expect(result.success).toBe(false);
    expect(mocks.grantAdminRole).not.toHaveBeenCalled();
  });

  it('grantAdminRoleAction returns the role and permissions', async () => {
    mocks.grantAdminRole.mockResolvedValue(
      ok({ user_id: 'user-1', role: 'admin', permissions: ['users.read'] })
    );

    const result = await grantAdminRoleAction('user-1', {
      role: 'admin',
      permissions: ['users.read'],
    });

    expect(result.data).toEqual({ adminUser: { role: 'admin', permissions: ['users.read'] } });
  });

  it.each([
    ['deleteUserAction', () => deleteUserAction('u1'), mocks.removeAdminUser],
    ['revokeAdminRoleAction', () => revokeAdminRoleAction('u1'), mocks.revokeAdminRole],
    ['banUserAction', () => banUserAction('u1', 'spam'), mocks.banAdminUser],
    ['unbanUserAction', () => unbanUserAction('u1'), mocks.unbanAdminUser],
  ])('%s reports success from the API', async (_name, call, api) => {
    api.mockResolvedValue(ok({}));

    const result = await call();

    expect(result.success).toBe(true);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['getUserByIdAction', () => getUserByIdAction('u1'), mocks.fetchAdminUser],
    ['updateUserAction', () => updateUserAction('u1', { bio: 'x' }), mocks.patchAdminUser],
    ['deleteUserAction', () => deleteUserAction('u1'), mocks.removeAdminUser],
    ['banUserAction', () => banUserAction('u1'), mocks.banAdminUser],
    ['unbanUserAction', () => unbanUserAction('u1'), mocks.unbanAdminUser],
    ['revokeAdminRoleAction', () => revokeAdminRoleAction('u1'), mocks.revokeAdminRole],
  ])('%s answers a 403 with the permission message and no backend text', async (_n, call, api) => {
    api.mockResolvedValue(fail(403));

    const result = await call();

    expect(result).toEqual({ success: false, error: 'You do not have permission to do that' });
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it('answers a 404 with a not-found message and does not log it', async () => {
    mocks.fetchAdminUser.mockResolvedValue(fail(404));

    const result = await getUserByIdAction('u1');

    expect(result.error).toBe('User not found');
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it('logs a server failure with its status only and answers generically', async () => {
    mocks.fetchAdminUsers.mockResolvedValue(fail(500));

    const result = await getAllUsersAction();

    expect(result.error).toBe('Something went wrong. Please try again.');
    expect(mocks.logError).toHaveBeenCalledWith(expect.any(String), { status: 500 });
    expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain('SECRET');
  });

  it('answers an unreachable backend with the unavailable message', async () => {
    mocks.fetchAdminUser.mockResolvedValue(fail(undefined));

    const result = await getUserByIdAction('u1');

    expect(result.error).toBe('The admin service is unavailable. Please try again later.');
  });

  it.each([
    '../etc',
    'a/b',
    '',
    'x'.repeat(200),
    '.',
    '..',
    'abc\n',
    '%2e%2e',
    'a%2Fb',
    '\uff41bc',
    'abc\u200b',
  ])('rejects the user id %j without calling the API', async (id) => {
    const results = await Promise.all([
      getUserByIdAction(id),
      updateUserAction(id, { bio: 'x' }),
      deleteUserAction(id),
      revokeAdminRoleAction(id),
      banUserAction(id),
      unbanUserAction(id),
    ]);

    for (const result of results) {
      expect(result).toEqual({ success: false, error: 'User not found' });
    }
    for (const api of [
      mocks.fetchAdminUser,
      mocks.patchAdminUser,
      mocks.removeAdminUser,
      mocks.revokeAdminRole,
      mocks.banAdminUser,
      mocks.unbanAdminUser,
    ]) {
      expect(api).not.toHaveBeenCalled();
    }
  });

  describe('server-side admin gate', () => {
    const DENIED = {
      ok: false,
      error: 'You do not have permission to do that',
      reason: 'not-admin',
    };
    const calls: Array<[string, () => Promise<{ success: boolean; error?: string }>]> = [
      ['getAllUsersAction', () => getAllUsersAction()],
      ['getUserByIdAction', () => getUserByIdAction('u1')],
      ['updateUserAction', () => updateUserAction('u1', { bio: 'x' })],
      ['deleteUserAction', () => deleteUserAction('u1')],
      [
        'grantAdminRoleAction',
        () => grantAdminRoleAction('u1', { role: 'admin', permissions: ['users.read'] }),
      ],
      ['revokeAdminRoleAction', () => revokeAdminRoleAction('u1')],
      ['banUserAction', () => banUserAction('u1', 'spam')],
      ['unbanUserAction', () => unbanUserAction('u1')],
    ];

    it.each(calls)('%s refuses a non-admin and never calls the API', async (_name, call) => {
      mocks.requireAdminSession.mockResolvedValue(DENIED);

      const result = await call();

      expect(result).toEqual({ success: false, error: DENIED.error });
      for (const api of [
        mocks.fetchAdminUsers,
        mocks.fetchAdminUser,
        mocks.patchAdminUser,
        mocks.removeAdminUser,
        mocks.grantAdminRole,
        mocks.revokeAdminRole,
        mocks.banAdminUser,
        mocks.unbanAdminUser,
      ]) {
        expect(api).not.toHaveBeenCalled();
      }
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('ban and unban', () => {
    it('banUserAction passes a trimmed reason and refreshes the users pages', async () => {
      mocks.banAdminUser.mockResolvedValue(ok({}));

      await banUserAction('user-1', '  spam  ');

      expect(mocks.banAdminUser).toHaveBeenCalledWith('user-1', 'spam');
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users');
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users/user-1');
    });

    it('banUserAction sends no reason when it is blank', async () => {
      mocks.banAdminUser.mockResolvedValue(ok({}));

      await banUserAction('user-1', '   ');

      expect(mocks.banAdminUser).toHaveBeenCalledWith('user-1', undefined);
    });

    it('banUserAction rejects a reason longer than the API allows without calling it', async () => {
      const result = await banUserAction('user-1', 'x'.repeat(201));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keep the reason to 200 characters or fewer.');
      expect(mocks.banAdminUser).not.toHaveBeenCalled();
    });

    it('unbanUserAction refreshes the users pages', async () => {
      mocks.unbanAdminUser.mockResolvedValue(ok({}));

      await unbanUserAction('user-1');

      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users');
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users/user-1');
    });

    it.each([
      ['banUserAction', () => banUserAction('u1'), mocks.banAdminUser],
      ['unbanUserAction', () => unbanUserAction('u1'), mocks.unbanAdminUser],
    ])(
      '%s answers a 409 with the own-account message and does not refresh',
      async (_n, call, api) => {
        api.mockResolvedValue(fail(409));

        const result = await call();

        expect(result).toEqual({
          success: false,
          error: 'You cannot suspend or restore your own account.',
        });
        expect(JSON.stringify(result)).not.toContain('SECRET');
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
      }
    );
  });

  describe('409 conflicts', () => {
    it('deleteUserAction explains what blocks the delete', async () => {
      mocks.removeAdminUser.mockResolvedValue(fail(409));

      const result = await deleteUserAction('u1');

      expect(result).toEqual({
        success: false,
        error:
          "This user cannot be deleted: you cannot delete your own account, and an admin's role must be revoked and any organisation ownership transferred first.",
      });
    });

    it.each([
      [
        'grantAdminRoleAction',
        () => grantAdminRoleAction('u1', { role: 'admin', permissions: [] }),
        mocks.grantAdminRole,
      ],
      ['revokeAdminRoleAction', () => revokeAdminRoleAction('u1'), mocks.revokeAdminRole],
    ])('%s explains a 409 and does not log it', async (_n, call, api) => {
      api.mockResolvedValue(fail(409));

      const result = await call();

      expect(result).toEqual({
        success: false,
        error: 'You cannot change your own admin role or remove the last super admin.',
      });
      expect(mocks.logError).not.toHaveBeenCalled();
    });

    it('updateUserAction and the reads answer a 409 generically', async () => {
      mocks.patchAdminUser.mockResolvedValue(fail(409));

      const result = await updateUserAction('u1', { bio: 'x' });

      expect(result).toEqual({ success: false, error: 'Something went wrong. Please try again.' });
    });

    it.each([
      ['banUserAction', () => banUserAction('u1'), mocks.banAdminUser],
      ['deleteUserAction', () => deleteUserAction('u1'), mocks.removeAdminUser],
      ['revokeAdminRoleAction', () => revokeAdminRoleAction('u1'), mocks.revokeAdminRole],
    ])('%s does not log a 409 as an error', async (_n, call, api) => {
      api.mockResolvedValue(fail(409));

      await call();

      expect(mocks.logError).not.toHaveBeenCalled();
    });
  });

  describe('updateUserAction validation', () => {
    it('trims text fields and sends a blank one as null', async () => {
      mocks.patchAdminUser.mockResolvedValue(ok(DETAIL));

      await updateUserAction('user-1', { displayName: '   ', bio: '  hi  ', location: '' });

      expect(mocks.patchAdminUser).toHaveBeenCalledWith('user-1', {
        display_name: null,
        bio: 'hi',
        location: null,
      });
    });

    it('trims the website and phone number, and sends a blank one as null', async () => {
      mocks.patchAdminUser.mockResolvedValue(ok(DETAIL));

      await updateUserAction('user-1', { website: '  https://x.y  ', phoneNumber: '   ' });

      expect(mocks.patchAdminUser).toHaveBeenCalledWith('user-1', {
        website: 'https://x.y',
        phone_number: null,
      });
    });

    it('accepts an https avatar', async () => {
      mocks.patchAdminUser.mockResolvedValue(ok(DETAIL));

      await updateUserAction('user-1', { avatarUrl: 'https://x.test/a.png' });

      expect(mocks.patchAdminUser).toHaveBeenCalledWith('user-1', {
        avatar_url: 'https://x.test/a.png',
      });
    });

    it('refreshes the users pages after a save', async () => {
      mocks.patchAdminUser.mockResolvedValue(ok(DETAIL));

      await updateUserAction('user-1', { displayName: 'Ada' });

      expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users/user-1');
    });

    it.each([
      ['a non-http website', { website: 'javascript:alert(1)' }],
      ['a data: website', { website: 'data:text/html,x' }],
      ['an upper-case scheme', { website: 'HTTPS://x.com' }],
      ['a scheme without slashes', { website: 'https:x.com' }],
      ['an http avatar', { avatarUrl: 'http://x.test/a.png' }],
      ['a javascript: avatar', { avatarUrl: 'javascript:x' }],
      ['a malformed phone number', { phoneNumber: 'call me' }],
      ['an over-long display name', { displayName: 'x'.repeat(101) }],
    ])('rejects %s before calling the API', async (_label, data) => {
      const result = await updateUserAction('user-1', data);

      expect(result.success).toBe(false);
      expect(mocks.patchAdminUser).not.toHaveBeenCalled();
    });
  });
});
