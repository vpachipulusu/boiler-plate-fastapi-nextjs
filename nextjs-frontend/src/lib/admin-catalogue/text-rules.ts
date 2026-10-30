/**
 * Text rules shared by the admin catalogue forms and their server actions. They mirror the backend
 * `line()` and `paragraph()` constraints (`app/api/v1/admin_catalogue_common.py`): no control characters at all
 * in a line, and only tab, line feed and carriage return in a paragraph. The API stays the authority.
 */

const C1_START = 0x7f;
const C1_END = 0x9f;
const LINE_SEPARATOR = 0x2028;
const PARAGRAPH_SEPARATOR = 0x2029;
const ALLOWED_IN_PARAGRAPH = new Set([0x09, 0x0a, 0x0d]);
const FIRST_PRINTABLE = 0x20;

function isForbidden(code: number): boolean {
  return (
    code < FIRST_PRINTABLE ||
    (code >= C1_START && code <= C1_END) ||
    code === LINE_SEPARATOR ||
    code === PARAGRAPH_SEPARATOR
  );
}

export function isSingleLine(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (isForbidden(value.charCodeAt(i))) return false;
  }
  return true;
}

export function isParagraphText(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (isForbidden(code) && !ALLOWED_IN_PARAGRAPH.has(code)) return false;
  }
  return true;
}

export const MAX_URL_LENGTH = 2048;

/** A basic client-side check: an https URL with a host. The API applies the full rule set. */
export function isHttpsUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '';
  } catch {
    return false;
  }
}

/** Lower-case ASCII words joined by single hyphens, as the backend slug rule requires. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN = 2;
export const SLUG_MAX = 80;
