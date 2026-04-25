/**
 * Pagination caps for unbounded list endpoints. Centralized so the
 * limits are easy to audit (P5 / P2 §4.6) and consistent across
 * repositories and routes.
 *
 * - DEFAULT_LIMIT: applied when caller didn't request a specific page size.
 * - MAX_LIMIT: hard ceiling — no caller can pull more rows in a single
 *   query, even if they explicitly ask for more.
 * - SEARCH_LIMIT: top-N "as-you-type" search responses (smaller than
 *   listing limits because UI typically only renders a handful of hits).
 */
export const BOOKINGS_DEFAULT_LIMIT = 200;
export const BOOKINGS_MAX_LIMIT = 1000;
export const BOOKINGS_SEARCH_LIMIT = 10;

export function clampBookingsPageSize(pageSize: number | undefined): number {
  const n = Math.floor(Number(pageSize) || BOOKINGS_DEFAULT_LIMIT);
  if (n <= 0) return BOOKINGS_DEFAULT_LIMIT;
  if (n > BOOKINGS_MAX_LIMIT) return BOOKINGS_MAX_LIMIT;
  return n;
}
