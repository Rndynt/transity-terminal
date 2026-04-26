/**
 * Pagination caps for unbounded list endpoints. Centralized so the
 * limits are easy to audit (P5 / P2 §4.6 / β-2) and consistent across
 * repositories and routes.
 *
 * - DEFAULT_LIMIT: applied when caller didn't request a specific page size.
 * - MAX_LIMIT: hard ceiling — no caller can pull more rows in a single
 *   query, even if they explicitly ask for more.
 * - SEARCH_LIMIT: top-N "as-you-type" search responses (smaller than
 *   listing limits because UI typically only renders a handful of hits).
 * - RECENT_LIMIT: dashboards / sidebars that show "last N" events
 *   (smaller than full list — UI shows summary, not full feed).
 */

// Bookings — high-volume table, dedicated tier.
export const BOOKINGS_DEFAULT_LIMIT = 200;
export const BOOKINGS_MAX_LIMIT = 1000;
export const BOOKINGS_SEARCH_LIMIT = 10;

// Generic list endpoints (cargo, spj, refunds, customers, etc.)
export const LIST_DEFAULT_LIMIT = 200;
export const LIST_MAX_LIMIT = 1000;

// Top-N search (customer phone lookup, etc.)
export const SEARCH_LIMIT = 10;

// "Recent N" feeds (notifications, dashboard recent bookings, etc.)
export const RECENT_LIMIT = 50;

export function clampBookingsPageSize(pageSize: number | undefined): number {
  const n = Math.floor(Number(pageSize) || BOOKINGS_DEFAULT_LIMIT);
  if (n <= 0) return BOOKINGS_DEFAULT_LIMIT;
  if (n > BOOKINGS_MAX_LIMIT) return BOOKINGS_MAX_LIMIT;
  return n;
}

/**
 * Generic pagination clamp untuk list endpoint non-bookings.
 * Default DEFAULT_LIMIT, hard cap MAX_LIMIT.
 */
export function clampListPageSize(pageSize: number | undefined): number {
  const n = Math.floor(Number(pageSize) || LIST_DEFAULT_LIMIT);
  if (n <= 0) return LIST_DEFAULT_LIMIT;
  if (n > LIST_MAX_LIMIT) return LIST_MAX_LIMIT;
  return n;
}
