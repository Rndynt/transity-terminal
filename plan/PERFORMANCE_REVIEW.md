# Performance Review — Pendekatan C Hybrid Refactor

_Date: 2026-03-22_

## 1. Frontend Component Sizes (After Refactor)

| File | Before | After | Extracted To |
|------|--------|-------|--------------|
| TripBasesManager.tsx | 1143L | 579L | TripBaseFormDialog (412L), TripBaseGroupList (284L) |
| TripsManager.tsx | ~960L | 801L | TripsFilterPanel (252L) |
| CsoPage.tsx | ~850L | 724L | CsoCargoPanel (167L) |

All large components are now under 810 lines. Major UI sections are independently testable sub-components.

## 2. N+1 Query Patterns

| Location | Issue | Severity | Recommendation |
|----------|-------|----------|----------------|
| `app.service.ts:searchTrips` (L315) | Per-trip queries for stopTimes, seatCount, baseFare | HIGH | Use batch join query with `inArray()` for stops; precompute available seats in a single CTE |
| `app.service.ts:getAppUserBookings` (L766) | Per-booking `getStopById` (x2) and `getPassengers` | MEDIUM | Join stops + passengers in the initial bookings query |
| `storage.ts:getRealTripsForCso` (L352) | Correlated subqueries for patternStops, availableSeats, hasPriceRule per row | MEDIUM | Convert to lateral joins or pre-aggregated CTEs |

## 3. Missing Database Indexes

| Table.Column | Used In | Priority |
|--------------|---------|----------|
| `trips.base_id` | Trip generation lookups | HIGH |
| `trip_stop_times.stop_id` | Search, manifests, joins | HIGH |
| `bookings.app_user_id` | User booking history | HIGH |
| `bookings.origin_stop_id` | Reports, CSO search | MEDIUM |
| `bookings.destination_stop_id` | Reports, CSO search | MEDIUM |
| `vehicles.layout_id` | FK join | LOW |
| `outlets.stop_id` | FK join | LOW |
| `*.deleted_at` (soft-delete cols) | Nearly all queries filter on this | MEDIUM |

## 4. Cache Headers

**Current state**: No explicit `Cache-Control` headers on any API route.

**Recommendations**:
- Master data endpoints (`/api/stops`, `/api/vehicles`, `/api/layouts`, `/api/outlets`, `/api/drivers`): `Cache-Control: private, max-age=300` (5 min)
- Trip patterns: `Cache-Control: private, max-age=60`
- Booking/CSO real-time data: No caching (current behavior is correct)
- Static assets: Already handled by Vite (`immutable, max-age=31536000`)

## 5. Bundle Observations

- Lucide icons are tree-shaken via named imports (good)
- TanStack Query + wouter are lightweight routing/data choices (good)
- `recharts` is imported only in report pages (code-split via lazy routes would help)
- No obvious duplicate dependencies

## 6. Action Items (Priority Order)

1. **Add indexes** on `trips.base_id`, `trip_stop_times.stop_id`, `bookings.app_user_id` — simple schema change, high impact
2. **Batch N+1 in searchTrips** — refactor to use a single joined query with `inArray`
3. **Add cache headers** for master data routes via a shared Fastify hook
4. **Lazy-load report pages** with `React.lazy()` to reduce initial bundle
5. **Consider materialized view** for CSO trip availability if load grows
