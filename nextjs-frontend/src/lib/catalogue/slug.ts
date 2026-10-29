/** The only slug shape the site accepts from the API or a URL: lower-case letters, digits and hyphens. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** The backend caps a category filter at 100 characters; longer would be a 422. */
export const MAX_SLUG_LENGTH = 100;

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}
