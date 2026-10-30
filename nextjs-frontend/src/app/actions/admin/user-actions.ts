'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { requireAdminSession } from '@/lib/api/admin-guard';
import type { ApiResult } from '@/lib/api/server';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  LOCATION_MAX,
  PHONE_PATTERN,
  SUSPEND_REASON_MAX,
  WEBSITE_ERROR,
  WEBSITE_MAX,
  WEBSITE_PATTERN,
} from '@/lib/admin-users/profile-schema';
import { USER_ID_PATTERN } from '@/lib/admin-users/user-id';
import {
  ADMIN_REQUEST_FAILED_MESSAGE,
  ADMIN_ROLE_CONFLICT_MESSAGE,
  ADMIN_USER_CONFLICT_MESSAGE,
  ADMIN_USER_DELETE_CONFLICT_MESSAGE,
  ADMIN_USER_NOT_FOUND_MESSAGE,
  ADMIN_USERS_PAGE_SIZE,
  adminErrorMessage,
  banAdminUser,
  fetchAdminUser,
  fetchAdminUsers,
  grantAdminRole,
  patchAdminUser,
  removeAdminUser,
  revokeAdminRole,
  toAdminUserDetail,
  toAdminUserSummary,
  unbanAdminUser,
} from '@/lib/api/admin-users';

/**
 * Admin user actions, served by the admin users API. Each action first confirms a verified admin session on the
 * server (the proxy cannot: Firebase verification needs Node.js), then the API authenticates the session again,
 * checks the admin permission on each call and writes the audit log. These actions validate input, call the
 * wrapper, turn failures into curated messages and refresh the admin pages after a write.
 *
 * Switched off, with no API behind them: user statistics and notifications to a user, and editing
 * email or subscription fields (the API updates profile fields only; billing lives under /).
 */

type AdminUserActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** User ids go into a URL path: only the characters real ids contain are accepted. */
const userIdSchema = z.string().regex(USER_ID_PATTERN, 'Invalid user id');

const MAX_PAGE_SIZE = 100;
const ADMIN_USERS_PATH = '/admin/users';
/** Input cap before the phone pattern (which allows 20 characters) gives its own message. */
const PHONE_MAX_INPUT = 64;

/** Runs `run` only for a confirmed admin; everyone else gets the curated refusal and nothing is called. */
async function asAdmin(
  run: () => Promise<AdminUserActionResponse>
): Promise<AdminUserActionResponse> {
  const gate = await requireAdminSession();
  if (!gate.ok) return { success: false, error: gate.error };
  return run();
}

function refreshUser(userId: string): void {
  revalidatePath(ADMIN_USERS_PATH);
  revalidatePath(`${ADMIN_USERS_PATH}/${userId}`);
}

/**
 * A 409 means a refused state change, not a fault, so it is not logged as an error. `conflictMessage` says why
 * for the action at hand; an action that passes none answers a 409 with the generic message.
 */
function failure(
  result: Extract<ApiResult<unknown>, { success: false }>,
  logMessage: string,
  conflictMessage?: string
): AdminUserActionResponse {
  const expected = [401, 403, 404, 409];
  if (result.status === undefined || !expected.includes(result.status)) {
    logger.error(logMessage, { status: result.status });
  }
  if (result.status === 409 && conflictMessage) return { success: false, error: conflictMessage };
  return { success: false, error: adminErrorMessage(result) };
}

function invalidUserId(): AdminUserActionResponse {
  return { success: false, error: ADMIN_USER_NOT_FOUND_MESSAGE };
}

const userFiltersSchema = z.object({
  search: z.string().max(100).optional(),
});

/**
 * Get users with search and pagination
 */
export async function getAllUsersAction(
  page = 1,
  limit = 20,
  filters?: z.infer<typeof userFiltersSchema>
): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    const parsed = userFiltersSchema.safeParse(filters ?? {});
    const pageSize = Math.min(
      Math.max(Math.trunc(limit) || ADMIN_USERS_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );
    const currentPage = Math.max(Math.trunc(page) || 1, 1);
    if (!parsed.success) {
      return { success: false, error: ADMIN_REQUEST_FAILED_MESSAGE };
    }

    const result = await fetchAdminUsers({
      search: parsed.data.search,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    });
    if (!result.success) {
      return failure(result, 'Admin list users failed');
    }

    return {
      success: true,
      data: {
        users: result.data.users.map(toAdminUserSummary),
        pagination: {
          page: currentPage,
          limit: result.data.limit,
          totalCount: result.data.total_count,
          totalPages: Math.ceil(result.data.total_count / result.data.limit),
        },
      },
    };
  });
}

/**
 * Get user by ID
 */
export async function getUserByIdAction(userId: string): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const result = await fetchAdminUser(userId);
    if (!result.success) {
      return failure(result, 'Admin get user failed');
    }
    return { success: true, data: { user: toAdminUserDetail(result.data) } };
  });
}

/** A text field is trimmed and a blank one means "clear it": null reaches the API. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

/** Like `clearableText`, for a field with a format: blank is allowed and clears it, anything else must match. */
const clearableMatching = (max: number, pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value === '' || pattern.test(value), message)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const updateUserSchema = z.object({
  displayName: clearableText(DISPLAY_NAME_MAX),
  bio: clearableText(BIO_MAX),
  location: clearableText(LOCATION_MAX),
  website: clearableMatching(WEBSITE_MAX, WEBSITE_PATTERN, WEBSITE_ERROR),
  phoneNumber: clearableMatching(
    PHONE_MAX_INPUT,
    PHONE_PATTERN,
    'Use 3 to 20 digits, spaces and + ( ) - . characters.'
  ),
  avatarUrl: z
    .string()
    .max(2048)
    .regex(/^https:\/\//, 'Enter a full https:// address.')
    .nullable()
    .optional(),
});

/**
 * Update a user's profile fields
 */
export async function updateUserAction(
  userId: string,
  data: z.infer<typeof updateUserSchema>
): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const validation = updateUserSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message };
    }

    const fields = validation.data;
    const result = await patchAdminUser(userId, {
      ...(fields.displayName !== undefined && { display_name: fields.displayName }),
      ...(fields.bio !== undefined && { bio: fields.bio }),
      ...(fields.location !== undefined && { location: fields.location }),
      ...(fields.website !== undefined && { website: fields.website }),
      ...(fields.phoneNumber !== undefined && { phone_number: fields.phoneNumber }),
      ...(fields.avatarUrl !== undefined && { avatar_url: fields.avatarUrl }),
    });
    if (!result.success) {
      return failure(result, 'Admin update user failed');
    }
    refreshUser(userId);
    return { success: true, data: { user: toAdminUserDetail(result.data) } };
  });
}

/**
 * Delete user
 */
export async function deleteUserAction(userId: string): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const result = await removeAdminUser(userId);
    if (!result.success) {
      return failure(result, 'Admin delete user failed', ADMIN_USER_DELETE_CONFLICT_MESSAGE);
    }
    refreshUser(userId);
    return { success: true, data: { message: 'User deleted successfully' } };
  });
}

const grantAdminRoleSchema = z.object({
  role: z.enum(['admin', 'super_admin']),
  permissions: z.array(z.string().max(100)).max(100),
});

/**
 * Grant admin role to user
 */
export async function grantAdminRoleAction(
  userId: string,
  data: z.infer<typeof grantAdminRoleSchema>
): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const validation = grantAdminRoleSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message };
    }

    const result = await grantAdminRole(userId, validation.data);
    if (!result.success) {
      return failure(result, 'Admin grant role failed', ADMIN_ROLE_CONFLICT_MESSAGE);
    }
    refreshUser(userId);
    return {
      success: true,
      data: {
        adminUser: { role: result.data.role, permissions: result.data.permissions },
      },
    };
  });
}

/**
 * Revoke admin role
 */
export async function revokeAdminRoleAction(userId: string): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const result = await revokeAdminRole(userId);
    if (!result.success) {
      return failure(result, 'Admin revoke role failed', ADMIN_ROLE_CONFLICT_MESSAGE);
    }
    refreshUser(userId);
    return { success: true, data: { message: 'Admin role revoked successfully' } };
  });
}

const suspendReasonSchema = z
  .string()
  .trim()
  .max(SUSPEND_REASON_MAX, `Keep the reason to ${SUSPEND_REASON_MAX} characters or fewer.`)
  .transform((value) => value || undefined)
  .optional();

/**
 * Ban (suspend) user: the backend disables the Firebase account, ends its sessions and audits the change.
 * The optional reason goes to the audit log only.
 */
export async function banUserAction(
  userId: string,
  reason?: string
): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const parsedReason = suspendReasonSchema.safeParse(reason);
    if (!parsedReason.success) {
      return { success: false, error: parsedReason.error.issues[0].message };
    }
    const result = await banAdminUser(userId, parsedReason.data);
    if (!result.success) {
      return failure(result, 'Admin ban user failed', ADMIN_USER_CONFLICT_MESSAGE);
    }
    refreshUser(userId);
    return { success: true, data: { message: 'User banned successfully' } };
  });
}

/**
 * Unban (restore) user: the backend enables the Firebase account again and audits the change.
 */
export async function unbanUserAction(userId: string): Promise<AdminUserActionResponse> {
  return asAdmin(async () => {
    if (!userIdSchema.safeParse(userId).success) {
      return invalidUserId();
    }
    const result = await unbanAdminUser(userId);
    if (!result.success) {
      return failure(result, 'Admin unban user failed', ADMIN_USER_CONFLICT_MESSAGE);
    }
    refreshUser(userId);
    return { success: true, data: { message: 'User unbanned successfully' } };
  });
}
