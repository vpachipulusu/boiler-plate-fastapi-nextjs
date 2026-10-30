/**
 * Admin user ids go into backend URL paths. Only the characters real ids contain are accepted, so "." and ".."
 * (which `encodeURIComponent` leaves alone and which rewrite a path) and "/" never get through. Not a
 * `'use server'` module, so pages, wrappers and actions can all share it.
 */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isAdminUserId(id: string): boolean {
  return USER_ID_PATTERN.test(id);
}
