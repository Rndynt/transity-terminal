-- ─── Report covering indexes (migration 0027) ─────────────────────────────────
--
-- These covering indexes allow index-only scans for the breakdown aggregation
-- queries in getRevenueSummary and getSalesReport (byChannel, byOutlet,
-- bySalesChannel).  In departure-date mode the planner scans trips by
-- service_date (idx_trips_service_date), then probes bookings per trip_id.
-- With INCLUDE columns the aggregation can be answered entirely from the index
-- without touching the heap — critical for 500K+ booking tables.
--
-- ── byChannel breakdown ───────────────────────────────────────────────────────
-- Groups by (channel), aggregates total_amount filtered by status.
-- trip_id is the leading key so nested-loop probes from the trips scan are fast.
CREATE INDEX IF NOT EXISTS idx_bookings_rpt_channel
  ON bookings (trip_id, status, channel)
  INCLUDE (total_amount);

-- ── byOutlet breakdown ────────────────────────────────────────────────────────
-- Groups by COALESCE(snap_outlet_name, outlet.name).  snap_outlet_name in
-- INCLUDE avoids a heap fetch for the common case where it is non-null.
CREATE INDEX IF NOT EXISTS idx_bookings_rpt_outlet
  ON bookings (trip_id, status, outlet_id)
  INCLUDE (total_amount, snap_outlet_name);

-- ── bySalesChannel breakdown (OTA only) ───────────────────────────────────────
-- Partial index — only rows where channel = 'OTA' and sales_channel_code is set,
-- which is the exact subset queried.  Keeps the index small.
CREATE INDEX IF NOT EXISTS idx_bookings_rpt_sales_ch
  ON bookings (trip_id, status, sales_channel_code)
  INCLUDE (total_amount, sales_channel_name)
  WHERE channel = 'OTA' AND sales_channel_code IS NOT NULL;
