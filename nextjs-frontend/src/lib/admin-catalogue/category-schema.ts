import { z } from 'zod';
import { isParagraphText, isSingleLine, SLUG_MAX, SLUG_MIN, SLUG_PATTERN } from './text-rules';
import { TINT_VALUES } from './offer-schema';

/** The category form, mirrored from `app/api/v1/admin_categories.py`. */

export const MAX_SORT_ORDER = 10_000;

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(80, 'Keep this to 80 characters or fewer.')
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
  shortName: z
    .string()
    .trim()
    .min(1, 'Enter a short name.')
    .max(40, 'Keep this to 40 characters or fewer.')
    .refine(isSingleLine, 'Remove line breaks and control characters.'),
  description: z
    .string()
    .trim()
    .min(1, 'Enter a description.')
    .max(300, 'Keep this to 300 characters or fewer.')
    .refine(isParagraphText, 'Remove control characters.'),
  intro: z
    .string()
    .trim()
    .min(1, 'Enter the introduction.')
    .max(1000, 'Keep this to 1000 characters or fewer.')
    .refine(isParagraphText, 'Remove control characters.'),
  tint: z.enum(TINT_VALUES, 'Choose a tint.'),
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, 'Enter a whole number from 0 to 10000.')
    .refine((value) => Number(value) <= MAX_SORT_ORDER, 'Enter a whole number from 0 to 10000.'),
  enabled: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  description: string;
  intro: string;
  tint: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
}

export function emptyCategoryFormValues(): CategoryFormValues {
  return {
    name: '',
    slug: '',
    shortName: '',
    description: '',
    intro: '',
    tint: 'blush',
    sortOrder: '0',
    enabled: true,
  };
}

export function categoryToFormValues(category: CategoryView): CategoryFormValues {
  return {
    name: category.name,
    slug: category.slug,
    shortName: category.shortName,
    description: category.description,
    intro: category.intro,
    tint: category.tint as CategoryFormValues['tint'],
    sortOrder: String(category.sortOrder),
    enabled: category.enabled,
  };
}
