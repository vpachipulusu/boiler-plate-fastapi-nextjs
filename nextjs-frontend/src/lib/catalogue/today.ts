/**
 * The UK calendar date. `isLive` and the 30-day expiry policy compare calendar days, so the day must
 * roll over at midnight in London (GMT or BST), not at midnight UTC.
 */
const LONDON_DATE_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The Europe/London calendar date (YYYY-MM-DD) of an instant. */
export function londonDate(instant: Date): string {
  const parts = Object.fromEntries(
    LONDON_DATE_PARTS.formatToParts(instant).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * A backend timestamp ("2026-10-29T23:30:00Z") as a London calendar date, or null when it is not a
 * readable date. A bare YYYY-MM-DD passes through unchanged.
 */
export function toLondonDate(value: string): string | null {
  if (ISO_DAY.test(value)) return value;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : londonDate(instant);
}
