/**
 * TransityTerminal — Query Performance Runner
 *
 * Menjalankan EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) untuk semua query berat.
 * Output: docs/explain-results.txt  +  docs/explain-results.json
 *
 * Jalankan:
 *   npx tsx docs/run-explain.ts
 *   npx tsx docs/run-explain.ts --json    # hanya JSON
 *   npx tsx docs/run-explain.ts --md      # append ke query-performance.md
 */
import "@server/lib/loadEnv";
import { db } from "@server/db";
import { sql } from "drizzle-orm";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// ─── Params: diisi dari data perfload yang sudah ada ─────────────────────────
// Refresh otomatis dari DB saat runtime
async function getParams() {
  const r = await db.execute(sql`
    SELECT
      (SELECT id::text FROM trips WHERE snap_route_code LIKE 'PL-%'
        AND service_date = CURRENT_DATE LIMIT 1)                      AS trip_today,
      (SELECT id::text FROM trips WHERE snap_route_code LIKE 'PL-%'
        AND service_date < CURRENT_DATE ORDER BY service_date DESC LIMIT 1) AS trip_past,
      (SELECT id::text FROM outlets WHERE name LIKE 'PL-%' LIMIT 1)  AS outlet_id,
      (SELECT stop_id::text FROM outlets WHERE name LIKE 'PL-%' LIMIT 1) AS outlet_stop_id,
      (SELECT id::text FROM bookings WHERE booking_code LIKE 'PL-%'
        AND status='paid' LIMIT 1)                                    AS booking_id,
      (SELECT service_date::text FROM trips WHERE snap_route_code LIKE 'PL-%'
        ORDER BY service_date LIMIT 1)                                AS date_from,
      (SELECT service_date::text FROM trips WHERE snap_route_code LIKE 'PL-%'
        ORDER BY service_date DESC LIMIT 1)                           AS date_to,
      CURRENT_DATE::text                                              AS today,
      (SELECT id::text FROM trip_patterns WHERE code LIKE 'PL-%' LIMIT 1) AS pattern_id
  `);
  return r.rows[0] as {
    trip_today: string; trip_past: string; outlet_id: string; outlet_stop_id: string;
    booking_id: string; date_from: string; date_to: string; today: string; pattern_id: string;
  };
}

// ─── Runner ───────────────────────────────────────────────────────────────────
interface QueryDef {
  id: string;
  name: string;
  source: string;
  description: string;
  query: (p: Awaited<ReturnType<typeof getParams>>) => string;
}

function makeQueries(p: Awaited<ReturnType<typeof getParams>>): QueryDef[] {
  return [

    // ════════════════════════════════════════════════════════════════════════
    // GROUP 1: CSO RESERVASI
    // ════════════════════════════════════════════════════════════════════════

    {
      id: "Q01",
      name: "getCsoAvailableTrips — Real Trips CTE",
      source: "scheduling.repository.ts:433",
      description: "Query utama CSO jadwal: 9 CTE (eligible_trips, outlet_stop_info, trip_bounds_agg, trip_bounds, boarding_check, booked_counts, hold_counts, pattern_paths, price_rule_check). Dijalankan setiap kali CSO buka halaman jadwal untuk satu tanggal.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH eligible_trips AS (
  SELECT t.id, t.base_id, t.pattern_id, t.vehicle_id, t.driver_id, t.capacity, t.status
  FROM trips t
  WHERE t.service_date = '${p.today}'
    AND t.deleted_at IS NULL
),
outlet_stop_info AS (
  SELECT tst.trip_id, tst.stop_sequence, COALESCE(tst.depart_at, tst.arrive_at) AS depart_at_outlet
  FROM trip_stop_times tst
  WHERE tst.stop_id = '${p.outlet_stop_id}'
    AND tst.deleted_at IS NULL
    AND tst.trip_id IN (SELECT id FROM eligible_trips)
),
trip_bounds_agg AS (
  SELECT tst.trip_id,
         MIN(tst.stop_sequence) AS min_seq,
         MAX(tst.stop_sequence) AS max_seq,
         COUNT(*)::int AS stop_count
  FROM trip_stop_times tst
  WHERE tst.deleted_at IS NULL
    AND tst.trip_id IN (SELECT id FROM eligible_trips)
  GROUP BY tst.trip_id
),
trip_bounds AS (
  SELECT tba.trip_id, tba.min_seq, tba.max_seq, tba.stop_count,
         tst_last.arrive_at AS final_arrival_at
  FROM trip_bounds_agg tba
  JOIN trip_stop_times tst_last
    ON tst_last.trip_id = tba.trip_id
   AND tst_last.stop_sequence = tba.max_seq
   AND tst_last.deleted_at IS NULL
),
boarding_check AS (
  SELECT tst.trip_id
  FROM trip_stop_times tst
  LEFT JOIN pattern_stops ps ON ps.pattern_id = (
    SELECT et.pattern_id FROM eligible_trips et WHERE et.id = tst.trip_id
  ) AND ps.stop_id = tst.stop_id AND ps.deleted_at IS NULL
  INNER JOIN trip_bounds tb ON tb.trip_id = tst.trip_id
  WHERE tst.stop_id = '${p.outlet_stop_id}'
    AND tst.deleted_at IS NULL
    AND tst.trip_id IN (SELECT id FROM eligible_trips)
    AND COALESCE(tst.boarding_allowed, ps.boarding_allowed, true) = true
    AND tst.depart_at IS NOT NULL
    AND tst.stop_sequence < tb.max_seq
),
booked_counts AS (
  SELECT b.trip_id, COUNT(p.id) AS cnt
  FROM bookings b
  JOIN passengers p ON p.booking_id = b.id
  JOIN trip_stop_times origin_tst ON origin_tst.trip_id = b.trip_id AND origin_tst.stop_id = b.origin_stop_id AND origin_tst.deleted_at IS NULL
  JOIN trip_stop_times dest_tst ON dest_tst.trip_id = b.trip_id AND dest_tst.stop_id = b.destination_stop_id AND dest_tst.deleted_at IS NULL
  JOIN outlet_stop_info osi ON osi.trip_id = b.trip_id
  WHERE b.trip_id IN (SELECT id FROM eligible_trips)
    AND b.status IN ('pending', 'confirmed', 'checked_in', 'paid')
    AND origin_tst.stop_sequence <= osi.stop_sequence
    AND osi.stop_sequence < dest_tst.stop_sequence
  GROUP BY b.trip_id
),
hold_counts AS (
  SELECT sh.trip_id, COUNT(*) AS cnt
  FROM seat_holds sh
  INNER JOIN outlet_stop_info osi ON osi.trip_id = sh.trip_id
  WHERE sh.trip_id IN (SELECT id FROM eligible_trips)
    AND sh.expires_at > NOW()
    AND sh.booking_id IS NULL
    AND EXISTS (
      SELECT 1 FROM unnest(sh.leg_indexes) AS leg_idx
      INNER JOIN trip_legs tl ON tl.trip_id = sh.trip_id AND tl.leg_index = leg_idx
      INNER JOIN trip_stop_times lo ON lo.trip_id = sh.trip_id AND lo.stop_id = tl.from_stop_id AND lo.deleted_at IS NULL
      INNER JOIN trip_stop_times ld ON ld.trip_id = sh.trip_id AND ld.stop_id = tl.to_stop_id AND ld.deleted_at IS NULL
      WHERE lo.stop_sequence <= osi.stop_sequence
        AND osi.stop_sequence < ld.stop_sequence
    )
  GROUP BY sh.trip_id
),
pattern_paths AS (
  SELECT ps.pattern_id, STRING_AGG(s.name, ' → ' ORDER BY ps.stop_sequence) AS path
  FROM pattern_stops ps
  JOIN stops s ON ps.stop_id = s.id
  WHERE ps.deleted_at IS NULL
    AND ps.pattern_id IN (SELECT DISTINCT pattern_id FROM eligible_trips)
  GROUP BY ps.pattern_id
),
price_rule_check AS (
  SELECT DISTINCT pr.pattern_id
  FROM price_rules pr
  WHERE pr.deleted_at IS NULL
    AND pr.pattern_id IN (SELECT DISTINCT pattern_id FROM eligible_trips)
)
SELECT
  et.id AS trip_id,
  et.base_id,
  et.pattern_id,
  tp.code AS pattern_code,
  v.code AS vehicle_code,
  v.plate AS vehicle_plate,
  d.name AS driver_name,
  et.capacity,
  et.status,
  osi.depart_at_outlet,
  tb.final_arrival_at,
  osi.stop_sequence AS outlet_stop_sequence,
  tb.stop_count,
  pp.path AS pattern_stops,
  GREATEST(0, COALESCE(et.capacity, 0) - COALESCE(bc.cnt, 0) - COALESCE(hc.cnt, 0)) AS available_seats,
  (EXISTS (SELECT 1 FROM price_rule_check prc WHERE prc.pattern_id = et.pattern_id)) AS has_price_rule
FROM eligible_trips et
INNER JOIN trip_patterns tp ON tp.id = et.pattern_id
LEFT JOIN vehicles v ON v.id = et.vehicle_id
LEFT JOIN drivers d ON d.id = et.driver_id
INNER JOIN outlet_stop_info osi ON osi.trip_id = et.id
INNER JOIN trip_bounds tb ON tb.trip_id = et.id
INNER JOIN boarding_check bc_check ON bc_check.trip_id = et.id
LEFT JOIN booked_counts bc ON bc.trip_id = et.id
LEFT JOIN hold_counts hc ON hc.trip_id = et.id
LEFT JOIN pattern_paths pp ON pp.pattern_id = et.pattern_id
`,
    },

    {
      id: "Q02",
      name: "getSeatInventory — per trip",
      source: "scheduling.repository.ts:877",
      description: "Fetch semua seat_inventory untuk satu trip (14 rows × 1 leg). Dipanggil setiap kali seatmap dibuka.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM seat_inventory
WHERE trip_id = '${p.trip_today}'
  AND leg_index = ANY(ARRAY[1])
`,
    },

    {
      id: "Q03",
      name: "atomicHold — SELECT FOR UPDATE (simulasi hold 1 kursi)",
      source: "atomicHold.service.ts:96",
      description: "Row-level lock pada seat_inventory + LEFT JOIN seat_holds untuk validasi ketersediaan sebelum hold. Dijalankan dalam transaksi untuk setiap klik 'Pesan'.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  si.seat_no,
  si.booked,
  si.hold_ref,
  sh.expires_at,
  sh.operator_id,
  sh.booking_id
FROM seat_inventory si
LEFT JOIN seat_holds sh ON sh.hold_ref = si.hold_ref
WHERE si.trip_id = '${p.trip_today}'
  AND si.seat_no = '2C'
  AND si.leg_index = ANY(ARRAY[1])
FOR UPDATE OF si
`,
    },

    {
      id: "Q04",
      name: "getManifest — manifest penumpang per trip",
      source: "scheduling.repository.ts:943",
      description: "Ambil semua penumpang untuk satu trip: passengers JOIN bookings LEFT JOIN stops × 2. Dipanggil saat cetak manifest.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  p.ticket_number         AS "ticketNumber",
  COALESCE(p.ticket_status, 'active') AS "ticketStatus",
  p.full_name             AS "passengerName",
  p.seat_no               AS "seatNo",
  p.phone,
  p.id_number             AS "idNumber",
  p.fare_amount           AS "fareAmount",
  b.booking_code          AS "bookingCode",
  b.status                AS "bookingStatus",
  b.channel,
  b.created_at            AS "createdAt",
  os.name                 AS "originStopName",
  ds.name                 AS "destinationStopName"
FROM passengers p
INNER JOIN bookings b ON b.id = p.booking_id
LEFT JOIN stops os ON os.id = b.origin_stop_id
LEFT JOIN stops ds ON ds.id = b.destination_stop_id
WHERE b.trip_id = '${p.trip_past}'
  AND b.status NOT IN ('cancelled', 'refunded', 'unseated')
  AND COALESCE(p.ticket_status, 'active') NOT IN ('unseated', 'cancelled')
ORDER BY p.seat_no ASC
`,
    },

    {
      id: "Q05",
      name: "getManifestFull — header trip (correlated subquery pattern_stops)",
      source: "scheduling.repository.ts:983",
      description: "Header manifest: trips JOIN vehicles JOIN trip_patterns LEFT JOIN drivers LEFT JOIN pattern_stops (correlated subquery MIN/MAX) LEFT JOIN stops × 2.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  t.id                          AS "tripId",
  t.service_date                AS "serviceDate",
  t.origin_depart_hhmm          AS "departureTime",
  t.manifest_first_printed_at   AS "firstPrintedAt",
  tp.name                       AS "routeName",
  v.plate                       AS "vehiclePlate",
  v.code                        AS "vehicleType",
  d.name                        AS "driverName",
  d.license_no                  AS "driverLicense",
  origin_s.name                 AS "originStop",
  dest_s.name                   AS "destinationStop"
FROM trips t
INNER JOIN vehicles v ON v.id = t.vehicle_id
INNER JOIN trip_patterns tp ON tp.id = t.pattern_id
LEFT JOIN drivers d ON d.id = t.driver_id
LEFT JOIN pattern_stops ps_origin ON ps_origin.pattern_id = t.pattern_id
  AND ps_origin.stop_sequence = (
    SELECT MIN(ps2.stop_sequence) FROM pattern_stops ps2 WHERE ps2.pattern_id = t.pattern_id
  )
LEFT JOIN stops origin_s ON origin_s.id = ps_origin.stop_id
LEFT JOIN pattern_stops ps_dest ON ps_dest.pattern_id = t.pattern_id
  AND ps_dest.stop_sequence = (
    SELECT MAX(ps3.stop_sequence) FROM pattern_stops ps3 WHERE ps3.pattern_id = t.pattern_id
  )
LEFT JOIN stops dest_s ON dest_s.id = ps_dest.stop_id
WHERE t.id = '${p.trip_past}'
`,
    },

    // ════════════════════════════════════════════════════════════════════════
    // GROUP 2: LAPORAN
    // ════════════════════════════════════════════════════════════════════════

    {
      id: "Q06",
      name: "getRevenueSummary — ringkasan keseluruhan (30 hari)",
      source: "reports.repository.ts:139",
      description: "SUM + COUNT bookings INNER JOIN trips, filter service_date range, status paid/confirmed/checked_in. Rentang 30 hari ~260K booking.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COALESCE(SUM(b.total_amount::numeric), 0) AS total_revenue,
  COUNT(*)::int AS total_bookings,
  COALESCE(AVG(b.total_amount::numeric), 0) AS avg_per_booking,
  COUNT(DISTINCT b.trip_id)::int AS total_trips
FROM bookings b
INNER JOIN trips t ON b.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
  AND b.status IN ('paid','confirmed','checked_in')
`,
    },

    {
      id: "Q07",
      name: "getRevenueSummary — harian (GROUP BY service_date)",
      source: "reports.repository.ts:171",
      description: "Revenue per hari: bookings JOIN trips GROUP BY service_date, 30 hari data.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  t.service_date::text AS date,
  COALESCE(SUM(b.total_amount::numeric), 0) AS revenue,
  COUNT(*)::int AS bookings
FROM bookings b
INNER JOIN trips t ON b.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
  AND b.status IN ('paid','confirmed','checked_in')
GROUP BY t.service_date
ORDER BY t.service_date
`,
    },

    {
      id: "Q08",
      name: "getRevenueSummary — per outlet (LEFT JOIN outlets)",
      source: "reports.repository.ts:196",
      description: "Revenue breakdown per outlet: bookings JOIN trips LEFT JOIN outlets, GROUP BY outlet name.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COALESCE(b.snap_outlet_name, o.name) AS outlet_name,
  COALESCE(SUM(b.total_amount::numeric), 0) AS revenue,
  COUNT(*)::int AS bookings
FROM bookings b
INNER JOIN trips t ON b.trip_id = t.id
LEFT JOIN outlets o ON b.outlet_id = o.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
  AND b.status IN ('paid','confirmed','checked_in')
GROUP BY COALESCE(b.snap_outlet_name, o.name)
ORDER BY revenue DESC
`,
    },

    {
      id: "Q09",
      name: "getRevenueSummary — per rute (LEFT JOIN trip_patterns)",
      source: "reports.repository.ts:222",
      description: "Revenue per rute: bookings JOIN trips LEFT JOIN trip_patterns GROUP BY route.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COALESCE(t.snap_route_name, tp.name) AS route_name,
  COALESCE(t.snap_route_code, tp.code) AS route_code,
  COALESCE(SUM(b.total_amount::numeric), 0) AS revenue,
  COUNT(*)::int AS bookings
FROM bookings b
INNER JOIN trips t ON b.trip_id = t.id
LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
  AND b.status IN ('paid','confirmed','checked_in')
GROUP BY COALESCE(t.snap_route_name, tp.name), COALESCE(t.snap_route_code, tp.code)
ORDER BY revenue DESC
`,
    },

    {
      id: "Q10",
      name: "getSalesReport — ringkasan dengan FILTER aggregates",
      source: "reports.repository.ts:250",
      description: "COUNT dengan FILTER per status (paid, cancelled, pending, confirmed, refunded, unseated). Seluruh booking 30 hari.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COUNT(*)::int AS total_bookings,
  COUNT(*) FILTER (WHERE b.status = 'paid')::int AS paid_count,
  COUNT(*) FILTER (WHERE b.status = 'cancelled')::int AS canceled_count,
  COUNT(*) FILTER (WHERE b.status = 'pending')::int AS pending_count,
  COUNT(*) FILTER (WHERE b.status = 'confirmed')::int AS confirmed_count,
  COUNT(*) FILTER (WHERE b.status = 'refunded')::int AS refunded_count,
  COALESCE(SUM(b.total_amount::numeric) FILTER (WHERE b.status IN ('paid','confirmed','checked_in')), 0) AS total_revenue,
  COUNT(DISTINCT b.trip_id)::int AS total_trips
FROM bookings b
INNER JOIN trips t ON b.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
`,
    },

    {
      id: "Q11",
      name: "getSalesReport — recent 100 booking (5 JOIN + ORDER BY created_at DESC)",
      source: "reports.repository.ts:353",
      description: "100 booking terbaru dengan 5 LEFT JOIN (trip_patterns, outlets, stops×2) + ORDER BY created_at DESC LIMIT 100. Hot path untuk tabel booking terkini.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.id, b.booking_code, b.status, b.channel, b.total_amount,
  b.created_at, t.service_date,
  COALESCE(t.snap_route_name, tp.name) AS route_name,
  COALESCE(b.snap_outlet_name, o.name, '-') AS outlet_name,
  COALESCE(b.snap_origin_stop_name, os.name) AS origin_name,
  COALESCE(b.snap_destination_stop_name, ds.name) AS destination_name
FROM bookings b
INNER JOIN trips t ON b.trip_id = t.id
LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
LEFT JOIN outlets o ON b.outlet_id = o.id
LEFT JOIN stops os ON b.origin_stop_id = os.id
LEFT JOIN stops ds ON b.destination_stop_id = ds.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
ORDER BY b.created_at DESC
LIMIT 100
`,
    },

    {
      id: "Q12",
      name: "getLoadFactor — per trip (subquery pax)",
      source: "reports.repository.ts:472",
      description: "Load factor per trip: trips LEFT JOIN trip_patterns LEFT JOIN drivers LEFT JOIN (passengers INNER JOIN bookings GROUP BY trip_id). Full table scan trips + correlated pax subquery.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  t.id AS trip_id,
  t.service_date::text,
  t.status AS trip_status,
  t.capacity,
  COALESCE(t.snap_route_name, tp.name) AS route_name,
  COALESCE(t.snap_route_code, tp.code) AS route_code,
  COALESCE(t.snap_driver_name, d.name) AS driver_name,
  COALESCE(pax.count, 0)::int AS passenger_count,
  CASE WHEN t.capacity > 0
    THEN ROUND(COALESCE(pax.count, 0)::numeric / t.capacity * 100, 1)
    ELSE 0
  END AS load_factor_pct
FROM trips t
LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
LEFT JOIN drivers d ON t.driver_id = d.id
LEFT JOIN (
  SELECT b.trip_id, COUNT(p.id) AS count
  FROM passengers p
  INNER JOIN bookings b ON p.booking_id = b.id
  WHERE p.ticket_status IN ('active','checked_in')
  GROUP BY b.trip_id
) pax ON pax.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
ORDER BY t.service_date DESC, tp.name
`,
    },

    {
      id: "Q13",
      name: "getLoadFactor — per rute (GROUP BY route)",
      source: "reports.repository.ts:500",
      description: "Load factor rata-rata per rute: trips LEFT JOIN pax subquery GROUP BY snap_route_name. 30 hari × 100 rute = 3.000 trips per hari.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COALESCE(t.snap_route_name, tp.name) AS route_name,
  COALESCE(t.snap_route_code, tp.code) AS route_code,
  COUNT(t.id)::int AS trip_count,
  SUM(t.capacity)::int AS total_capacity,
  COALESCE(SUM(pax.count), 0)::int AS total_passengers,
  CASE WHEN SUM(t.capacity) > 0
    THEN ROUND(COALESCE(SUM(pax.count), 0)::numeric / SUM(t.capacity) * 100, 1)
    ELSE 0
  END AS avg_load_factor_pct
FROM trips t
LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
LEFT JOIN (
  SELECT b.trip_id, COUNT(p.id) AS count
  FROM passengers p
  INNER JOIN bookings b ON p.booking_id = b.id
  WHERE p.ticket_status IN ('active','checked_in')
  GROUP BY b.trip_id
) pax ON pax.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
GROUP BY COALESCE(t.snap_route_name, tp.name), COALESCE(t.snap_route_code, tp.code)
ORDER BY avg_load_factor_pct DESC
`,
    },

    {
      id: "Q14",
      name: "getLoadFactor — harian (GROUP BY service_date)",
      source: "reports.repository.ts:545",
      description: "Load factor per hari: trips LEFT JOIN pax GROUP BY service_date, 30 hari.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  t.service_date::text AS date,
  COUNT(t.id)::int AS trips,
  SUM(t.capacity)::int AS capacity,
  COALESCE(SUM(pax.count), 0)::int AS passengers,
  CASE WHEN SUM(t.capacity) > 0
    THEN ROUND(COALESCE(SUM(pax.count), 0)::numeric / SUM(t.capacity) * 100, 1)
    ELSE 0
  END AS load_factor_pct
FROM trips t
LEFT JOIN (
  SELECT b.trip_id, COUNT(p.id) AS count
  FROM passengers p
  INNER JOIN bookings b ON p.booking_id = b.id
  WHERE p.ticket_status IN ('active','checked_in')
  GROUP BY b.trip_id
) pax ON pax.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
GROUP BY t.service_date
ORDER BY t.service_date
`,
    },

    {
      id: "Q15",
      name: "getCancellationsReport — ringkasan booking_history",
      source: "reports.repository.ts:580",
      description: "COUNT DISTINCT events dari booking_history INNER JOIN bookings INNER JOIN trips. Tabel booking_history mungkin tidak terisi perfload data (tanpa riwayat pembatalan).",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  COUNT(DISTINCT bh.id)::int AS total_events,
  COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'cancelled')::int AS canceled_count,
  COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'unseated')::int AS unseated_count,
  COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'rescheduled')::int AS rescheduled_count
FROM booking_history bh
INNER JOIN bookings b ON bh.booking_id = b.id
INNER JOIN trips t ON b.trip_id = t.id
WHERE t.service_date >= '${p.date_from}'
  AND t.service_date <= '${p.date_to}'
`,
    },

    // ════════════════════════════════════════════════════════════════════════
    // GROUP 3: OPERASIONAL TRIP
    // ════════════════════════════════════════════════════════════════════════

    {
      id: "Q16",
      name: "getBookingsPaginated — tanpa filter outlet (all bookings page 1)",
      source: "booking.repository.ts:52",
      description: "Daftar semua booking paginated tanpa outlet filter (dev user / owner). COUNT(*) + SELECT dengan ORDER BY created_at DESC. Total ~260K rows.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*)::int AS total FROM bookings
`,
    },

    {
      id: "Q16b",
      name: "getBookingsPaginated — SELECT halaman pertama (ORDER BY created_at DESC)",
      source: "booking.repository.ts:62",
      description: "SELECT 20 booking pertama ORDER BY created_at DESC LIMIT 20 OFFSET 0 tanpa filter.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM bookings
ORDER BY created_at DESC
LIMIT 20 OFFSET 0
`,
    },

    {
      id: "Q17",
      name: "getActiveBookingsForTrip — booking aktif per trip",
      source: "booking.repository.ts:25",
      description: "Semua booking aktif (bukan cancelled/refunded/unseated) untuk satu trip. Dipanggil saat seatmap dibuka.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM bookings
WHERE trip_id = '${p.trip_today}'
  AND status NOT IN ('cancelled', 'refunded', 'unseated')
`,
    },

    {
      id: "Q18",
      name: "seat_inventory bulk scan — precompute check",
      source: "seatInventory.service.ts (precomputeInventory)",
      description: "Scan seluruh seat_inventory untuk satu trip saat precompute. 14 rows per trip.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT si.seat_no, si.leg_index, si.booked, si.hold_ref
FROM seat_inventory si
WHERE si.trip_id = '${p.trip_today}'
ORDER BY si.seat_no, si.leg_index
`,
    },

    {
      id: "Q19",
      name: "seat_holds expired cleanup — scheduler",
      source: "scheduler (every 60s)",
      description: "Cleanup holds expired: UPDATE seat_inventory + DELETE seat_holds WHERE expires_at < NOW(). Dijalankan scheduler setiap 60 detik.",
      query: (p) => `
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT sh.id, sh.hold_ref, sh.trip_id, sh.seat_no, sh.leg_indexes, sh.expires_at
FROM seat_holds sh
WHERE sh.expires_at <= NOW()
  AND sh.booking_id IS NULL
`,
    },

  ];
}

// ─── Execute & Format ─────────────────────────────────────────────────────────
interface QueryResult {
  id: string;
  name: string;
  source: string;
  description: string;
  planText: string;
  executionTimeMs: number | null;
  planningTimeMs: number | null;
  error?: string;
}

async function runExplain(qd: QueryDef, p: Awaited<ReturnType<typeof getParams>>): Promise<QueryResult> {
  const qs = qd.query(p).trim();
  const start = Date.now();
  try {
    const result = await db.execute(sql.raw(qs));
    const wallMs = Date.now() - start;
    const planLines: string[] = (result.rows as Array<{ "QUERY PLAN": string }>)
      .map(r => r["QUERY PLAN"] || Object.values(r)[0] as string);
    const planText = planLines.join("\n");

    // Extract timing from plan
    const execMatch = planText.match(/Execution Time:\s*([\d.]+)\s*ms/);
    const planMatch = planText.match(/Planning Time:\s*([\d.]+)\s*ms/);
    const executionTimeMs = execMatch ? parseFloat(execMatch[1]) : wallMs;
    const planningTimeMs  = planMatch ? parseFloat(planMatch[1]) : null;

    return { id: qd.id, name: qd.name, source: qd.source, description: qd.description, planText, executionTimeMs, planningTimeMs };
  } catch (err: any) {
    return { id: qd.id, name: qd.name, source: qd.source, description: qd.description, planText: "", executionTimeMs: null, planningTimeMs: null, error: err.message };
  }
}

function severity(ms: number | null): string {
  if (ms === null) return "❓";
  if (ms < 10)    return "✅";
  if (ms < 100)   return "🟡";
  if (ms < 500)   return "🟠";
  if (ms < 2000)  return "🔴";
  return "💀";
}

function formatResult(r: QueryResult, idx: number): string {
  const timing = r.error
    ? `ERROR: ${r.error}`
    : `Planning: ${r.planningTimeMs?.toFixed(2) ?? "?"}ms  |  Execution: ${r.executionTimeMs?.toFixed(2) ?? "?"}ms  ${severity(r.executionTimeMs)}`;

  return [
    `${"═".repeat(80)}`,
    `${r.id} — ${r.name}`,
    `Source : ${r.source}`,
    `Purpose: ${r.description}`,
    `Timing : ${timing}`,
    `─${"─".repeat(79)}`,
    r.error ? `ERROR: ${r.error}` : r.planText,
    "",
  ].join("\n");
}

async function main() {
  const args    = process.argv.slice(2);
  const doJson  = args.includes("--json");
  const doMd    = args.includes("--md");

  console.log("Fetching real parameters from DB ...");
  const p = await getParams();
  console.log(`  today=${p.today}  trip_today=${p.trip_today?.slice(0,8)}...  outlet=${p.outlet_id?.slice(0,8)}...`);

  const queries = makeQueries(p);
  const results: QueryResult[] = [];

  console.log(`\nRunning ${queries.length} EXPLAIN ANALYZE queries...\n`);

  // Run sequentially to avoid lock contention on FOR UPDATE queries
  for (const qd of queries) {
    process.stdout.write(`  ${qd.id} ${qd.name.padEnd(55)} `);
    const r = await runExplain(qd, p);
    results.push(r);
    if (r.error) {
      console.log(`ERROR`);
    } else {
      const exec = r.executionTimeMs?.toFixed(1) ?? "?";
      const plan = r.planningTimeMs?.toFixed(1) ?? "?";
      console.log(`plan=${plan}ms  exec=${exec}ms  ${severity(r.executionTimeMs)}`);
    }
  }

  // ─── Summary table ──────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log("SUMMARY");
  console.log("═".repeat(80));
  console.log(`${"ID".padEnd(6)} ${"Exec (ms)".padEnd(12)} ${"Plan (ms)".padEnd(12)} ${"Sev".padEnd(4)} ${"Name"}`);
  console.log("─".repeat(80));
  for (const r of results) {
    const exec  = r.executionTimeMs?.toFixed(1) ?? "ERR";
    const plan  = r.planningTimeMs?.toFixed(1) ?? "ERR";
    const sev   = severity(r.executionTimeMs);
    console.log(`${r.id.padEnd(6)} ${exec.padEnd(12)} ${plan.padEnd(12)} ${sev.padEnd(4)} ${r.name}`);
  }

  const docsDir = new URL(".", import.meta.url).pathname;

  // ─── Write TXT ─────────────────────────────────────────────────────────
  const txtPath = path.join(docsDir, "explain-results.txt");
  const header = [
    `TransityTerminal — EXPLAIN ANALYZE Results`,
    `Generated: ${new Date().toISOString()}`,
    `Dataset: perfload (60K trips, 840K seat_inventory, ~260K bookings)`,
    `Parameters: today=${p.today}, date_from=${p.date_from}, date_to=${p.date_to}`,
    "",
    "SEVERITY LEGEND:",
    "  ✅ < 10ms   🟡 10–100ms   🟠 100–500ms   🔴 500–2000ms   💀 >2000ms",
    "",
  ].join("\n");

  const summaryBlock = [
    "SUMMARY",
    "═".repeat(80),
    `${"ID".padEnd(6)} ${"Exec (ms)".padEnd(12)} ${"Plan (ms)".padEnd(12)} Sev  Name`,
    "─".repeat(80),
    ...results.map(r => {
      const exec = r.error ? "ERROR" : (r.executionTimeMs?.toFixed(1) ?? "?");
      const plan = r.error ? "ERROR" : (r.planningTimeMs?.toFixed(1) ?? "?");
      return `${r.id.padEnd(6)} ${exec.padEnd(12)} ${plan.padEnd(12)} ${severity(r.executionTimeMs).padEnd(5)} ${r.name}`;
    }),
    "",
    "DETAIL",
    "═".repeat(80),
    ...results.map((r, i) => formatResult(r, i)),
  ].join("\n");

  await fs.writeFile(txtPath, header + summaryBlock, "utf8");
  console.log(`\n✓ TXT written: ${txtPath}`);

  // ─── Write JSON ────────────────────────────────────────────────────────
  if (doJson || true) {
    const jsonPath = path.join(docsDir, "explain-results.json");
    await fs.writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), params: p, results }, null, 2), "utf8");
    console.log(`✓ JSON written: ${jsonPath}`);
  }

  // ─── Append to MD ───────────────────────────────────────────────────────
  if (doMd) {
    const mdPath = path.join(docsDir, "query-performance.md");
    let md = await fs.readFile(mdPath, "utf8").catch(() => "");
    // Replace section after "## EXPLAIN ANALYZE Results"
    const marker = "## EXPLAIN ANALYZE Results";
    const idx = md.indexOf(marker);
    if (idx >= 0) md = md.slice(0, idx + marker.length + 1);

    const mdBlock = [
      "",
      `> **Dijalankan:** ${new Date().toISOString()}`,
      `> **Dataset:** 60K trips · 840K seat_inventory · ~260K bookings`,
      `> **today=** \`${p.today}\`  |  **range:** \`${p.date_from}\` → \`${p.date_to}\``,
      "",
      "### Ringkasan Waktu Eksekusi",
      "",
      "| ID | Query | Plan (ms) | Exec (ms) | Severity |",
      "|---|---|---:|---:|:---:|",
      ...results.map(r => {
        const exec = r.error ? "ERR" : (r.executionTimeMs?.toFixed(1) ?? "?");
        const plan = r.error ? "ERR" : (r.planningTimeMs?.toFixed(1) ?? "?");
        return `| ${r.id} | ${r.name} | ${plan} | ${exec} | ${severity(r.executionTimeMs)} |`;
      }),
      "",
      "### Detail Plan",
      "",
      ...results.map(r => [
        `#### ${r.id} — ${r.name}`,
        `**Source:** \`${r.source}\`  `,
        `**Purpose:** ${r.description}  `,
        r.error
          ? `**⛔ ERROR:** \`${r.error}\``
          : `**Timing:** Planning \`${r.planningTimeMs?.toFixed(2)}ms\` · Execution \`${r.executionTimeMs?.toFixed(2)}ms\` ${severity(r.executionTimeMs)}`,
        "",
        "```",
        r.error ? r.error : r.planText,
        "```",
        "",
      ].join("\n")),
    ].join("\n");

    await fs.writeFile(mdPath, md + mdBlock, "utf8");
    console.log(`✓ MD updated: ${mdPath}`);
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
