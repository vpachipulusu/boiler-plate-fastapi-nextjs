import { z } from 'zod';
import { isHttpsUrl, isSingleLine, SLUG_MAX, SLUG_MIN, SLUG_PATTERN } from './text-rules';

/** The merchant form, mirrored from `app/api/v1/admin_merchants.py`. */

const optionalHttpsUrl = z
  .string()
  .trim()
  .refine((value) => value === '' || isHttpsUrl(value), 'Enter a full https:// address.');

export const merchantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(120, 'Keep this to 120 characters or fewer.')
    .refine(isSingleLine, 'Remove line breaks and control characters.'),
  slug: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (value.length >= SLUG_MIN && value.length <= SLUG_MAX && SLUG_PATTERN.test(value)),
      `Use ${SLUG_MIN} to ${SLUG_MAX} lower-case letters, numbers and single hyphens.`
    ),
  website: optionalHttpsUrl,
  logoUrl: optionalHttpsUrl,
  active: z.boolean(),
});

export type MerchantFormValues = z.infer<typeof merchantFormSchema>;

export interface MerchantView {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  active: boolean;
  updatedAt: string;
}

export function emptyMerchantFormValues(): MerchantFormValues {
  return { name: '', slug: '', website: '', logoUrl: '', active: true };
}

export function merchantToFormValues(merchant: MerchantView): MerchantFormValues {
  return {
    name: merchant.name,
    slug: merchant.slug,
    website: merchant.website ?? '',
    logoUrl: merchant.logoUrl ?? '',
    active: merchant.active,
  };
}
