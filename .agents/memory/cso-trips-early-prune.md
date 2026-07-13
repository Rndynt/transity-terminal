---
name: getRealTripsForCso early outlet prune
description: Q01 CTE restructure — start from outlet_trips not eligible_trips to avoid 2000+ trip scan
---

## Rule
`getRealTripsForCso` CTE order MUST be: `outlet_trips` first (most selective), then `trip_meta`, then all downstream CTEs. Never load all trips for the date first and join outlet later.

## The problem
Old structure: `eligible_trips` = all trips for service_date (~2034 rows), then `outlet_stop_info` joins from that. Every CTE downstream processed 2034 trips then pruned to ~80 at the end. Caused 2,648ms execution.

## The fix
New structure:
1. `outlet_trips` — JOIN `trip_stop_times(stop_id=outletId)` × `trips(service_date=date)` → gets ~80 trip_ids upfront. Uses `idx_tst_trip_stop` + `idx_trips_date_status`.
2. `trip_meta` — fetch metadata only for those ~80 trips.
3. `trip_bounds`, `boarding_check`, `booked_counts`, `hold_counts`, `pattern_paths`, `price_rule_check` — all scoped with `WHERE trip_id IN (SELECT trip_id FROM outlet_trips)` or direct JOIN.

## boarding_check correlated subquery fix
Old: `LEFT JOIN pattern_stops ps ON ps.pattern_id = (SELECT et.pattern_id FROM eligible_trips et WHERE et.id = tst.trip_id)` — O(n) re-scan per row.
New: `INNER JOIN trip_meta tm ON tm.id = tst.trip_id` then `LEFT JOIN pattern_stops ps ON ps.pattern_id = tm.pattern_id` — single hash join.

**Why:** A correlated subquery inside a JOIN ON clause re-executes for every row of trip_stop_times, causing O(rows × trips) work. The JOIN collapses this to a single hash lookup.

**How to apply:** Any time a CTE or subquery has `(SELECT ... FROM upstream_cte WHERE id = outer.id)` as a join predicate, rewrite as a direct JOIN to the upstream CTE.
