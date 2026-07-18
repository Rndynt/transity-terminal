/**
 * Pagination caps for unbounded list endpoints. Centralized so the
 * limits are easy to audit (P5 / P2 §4.6 / β-2) and consistent across
 * repositories and routes.
 *
 * - DEFAULT_LIMIT: applied when caller didn't request a specific page size.
 * - MAX_LIMIT: hard ceiling — no caller can pull more rows in a single
 *   query, even if they explicitly ask for more.
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

// "Recent N" feeds (notifications, dashboard recent bookings, etc.)
export const RECENT_LIMIT = 50;

// Customer profile listing — narrower than generic LIST tier karena
// admin UI render full row dengan banyak metadata (tag, totalTrips, dst.)
// dan operator umumnya tidak butuh > 100 row sekaligus.
export const CUSTOMERS_DEFAULT_LIMIT = 100;
export const CUSTOMERS_MAX_LIMIT = 500;
