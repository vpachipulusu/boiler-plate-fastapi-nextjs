/** Rows per page of the admin offers list. Shared by the page (client-safe) and the API wrapper. */
export const ADMIN_OFFERS_PAGE_SIZE = 25;

/** The API refuses an offset past this, so no page beyond the one that reaches it can exist. */
export const MAX_OFFSET = 1_000_000;
