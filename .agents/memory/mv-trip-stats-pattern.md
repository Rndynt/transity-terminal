---
name: mv_trip_stats materialized view
description: Per-trip booking stats precomputed for report fast path; query pattern + refresh strategy
---

## Rule
Report queries (revenue summary, sales report, load factor) MUST use `mv_trip_stats` instead of aggregating live booking rows for the departure-date mode when no booking-level filters (outletId / channel / salesChannelCode) are set.

## What the view contains
- `trip_id` (UNIQUE) — one row per trip
- `total_bookings`, `paid_bookings`, `cancelled_bookings`, `pending_bookings`, `confirmed_bookings`, `refunded_bookings`, `unseated_bookings`
- `paid_revenue` — SUM(total_amount) for paid/confirmed/checked_in bookings
- `active_pax` — COUNT(passengers) with ticket_status IN ('active','checked_in')

## Fast-path condition
```typescript
const canUseMv = mode === 'departure' && !f.outletId && !f.channel && !f.salesChannelCode;
const tripWhere = canUseMv ? joinConditions(tripFilters(f, 't')) : null;
```
When true: join `mv_trip_stats ms ON ms.trip_id = t.id` and use `ms.paid_revenue`, `ms.paid_bookings`, etc.
When false: fall back to live booking scan.

**For getLoadFactor: ALWAYS use mv_trip_stats** (no booking-level filters ever apply to the pax count).

## Refresh strategy
- Scheduler runs `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trip_stats` every 5 min
- Advisory lock `8240_007` prevents parallel refreshes across instances
- Startup kick ensures view is fresh immediately after deploy
- Reports tolerate ≤5 min staleness (acceptable for daily/weekly dashboards)
- Graceful: if view doesn't exist (pre-migration), the refresh call is a no-op (error swallowed)

## Benchmark results (with 2× perfload dataset: 500K+ bookings, 120K trips)
- Q06 revenue summary: 1,477ms → **82ms** (~18×)
- Q12 load factor: 2,311ms → **118ms** (~20×)

**Why:** Aggregating 500K booking rows on every report request was the root cause. The mv stores pre-aggregated per-trip stats (one row per trip), so reports aggregate ~60K–120K mv rows instead.

**How to apply:** Always check `canUseMv` before building report queries. The breakpoint is outletId/channel filters which are booking-level and can't be satisfied by the trip-level mv.
