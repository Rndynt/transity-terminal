-- Migration 0026: Materialized view for per-trip booking stats
--
-- Precomputes booking counts + revenue + active-pax per trip so that
-- report queries (revenue summary, load factor) can join this ~60K-row
-- view instead of scanning 500K+ bookings every request.
--
-- Refresh strategy: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_stats
-- is run by the scheduler every 5 minutes (advisory-lock-protected so only
-- one instance refreshes at a time). Reports tolerate up to ~5 min staleness.
--
-- Safe to re-run: CREATE IF NOT EXISTS on view + CONCURRENTLY-safe index.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trip_stats AS
SELECT
  bk.trip_id,
  bk.total_bookings,
  bk.paid_bookings,
  bk.cancelled_bookings,
  bk.pending_bookings,
  bk.confirmed_bookings,
  bk.refunded_bookings,
  bk.unseated_bookings,
  bk.paid_revenue,
  COALESCE(px.active_pax, 0) AS active_pax
FROM (
  -- Per-trip booking aggregates (no passenger join → no fan-out)
  SELECT
    trip_id,
    COUNT(*)                                                                       AS total_bookings,
    COUNT(*) FILTER (WHERE status IN ('paid','confirmed','checked_in'))            AS paid_bookings,
    COUNT(*) FILTER (WHERE status = 'cancelled')                                   AS cancelled_bookings,
    COUNT(*) FILTER (WHERE status = 'pending')                                     AS pending_bookings,
    COUNT(*) FILTER (WHERE status = 'confirmed')                                   AS confirmed_bookings,
    COUNT(*) FILTER (WHERE status = 'refunded')                                    AS refunded_bookings,
    COUNT(*) FILTER (WHERE status = 'unseated')                                    AS unseated_bookings,
    COALESCE(
      SUM(total_amount::numeric) FILTER (WHERE status IN ('paid','confirmed','checked_in')),
      0
    )                                                                              AS paid_revenue
  FROM bookings
  GROUP BY trip_id
) bk
LEFT JOIN (
  -- Active passenger count per trip (separate aggregation to avoid amount fan-out)
  SELECT b.trip_id, COUNT(p.id) AS active_pax
  FROM passengers p
  INNER JOIN bookings b ON b.id = p.booking_id
  WHERE p.ticket_status IN ('active','checked_in')
  GROUP BY b.trip_id
) px ON px.trip_id = bk.trip_id;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS mv_trip_stats_trip_id ON mv_trip_stats (trip_id);
