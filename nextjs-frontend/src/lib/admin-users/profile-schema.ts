import { z } from 'zod';

/**
 * The admin edit-profile form, mirrored from `UpdateUserRequest` in `app/api/v1/admin_users.py`. Only the profile
 * fields the user details page already shows are editable; the backend validates again.
 */

export const DISPLAY_NAME_MAX = 100;
export const BIO_MAX = 500;
export const LOCATION_MAX = 100;
export const WEBSITE_MAX = 2048;
export const PHONE_PATTERN = /^[0-9+()\-. ]{3,20}$/;
/** The reason an admin gives when suspending an account; the API caps it at 200 characters. */
export const SUSPEND_REASON_MAX = 200;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function text(max: number) {
  return z.string().trim().max(max, `Keep this to ${max} characters or fewer.`);
}

/** Blank means "clear this field" and is sent to the API as null. */
export const userProfileFormSchema = z.object({
  displayName: text(DISPLAY_NAME_MAX),
  bio: text(BIO_MAX),
  location: text(LOCATION_MAX),
  website: text(WEBSITE_MAX).refine(
    (value) => value === '' || isHttpUrl(value),
    'Enter a full http:// or https:// address.'
  ),
  phoneNumber: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || PHONE_PATTERN.test(value),
      'Use 3 to 20 digits, spaces and + ( ) - . characters.'
    ),
});

export type UserProfileFormValues = z.infer<typeof userProfileFormSchema>;

export interface UserProfileSource {
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  phoneNumber: string | null;
}

export function userToProfileFormValues(user: UserProfileSource): UserProfileFormValues {
  return {
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    location: user.location ?? '',
    website: user.website ?? '',
    phoneNumber: user.phoneNumber ?? '',
  };
}

/** The action input for the form's values: a blank field becomes null so the API clears it. */
export function toProfileUpdateInput(values: UserProfileFormValues) {
  return {
    displayName: values.displayName === '' ? null : values.displayName,
    bio: values.bio === '' ? null : values.bio,
    location: values.location === '' ? null : values.location,
    website: values.website === '' ? null : values.website,
    phoneNumber: values.phoneNumber === '' ? null : values.phoneNumber,
  };
}
