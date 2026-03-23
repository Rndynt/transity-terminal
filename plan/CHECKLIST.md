# TransityTerminal — Refactor Checklist

## Phase 1: Pecah Schema
- [x] Buat `shared/schema/enums.ts` — pindahkan semua pgEnum
- [x] Buat `shared/schema/fleet.ts` — drivers, vehicles, layouts
- [x] Buat `shared/schema/network.ts` — stops, outlets
- [x] Buat `shared/schema/scheduling.ts` — tripPatterns, patternStops, tripBases, trips, tripStopTimes, tripLegs
- [x] Buat `shared/schema/inventory.ts` — seatInventory, seatHolds, priceRules
- [x] Buat `shared/schema/booking.ts` — bookings, passengers, payments, printJobs
- [x] Buat `shared/schema/cargo.ts` — cargoShipments, cargoTypes, cargoRates
- [x] Buat `shared/schema/finance.ts` — tripCostTemplates, tripCostItems
- [x] Buat `shared/schema/promo.ts` — promotions, vouchers
- [x] Buat `shared/schema/index.ts` — re-export semua
- [x] Hapus `shared/schema.ts` lama (sekarang re-export dari index)
- [x] Verifikasi: semua import `@shared/schema` tetap berjalan

## Phase 2: Extract IStorage + Update Imports
- [x] Buat `server/storage.interface.ts` — IStorage + ManifestEntry/ManifestFull/ManifestCargoEntry types
- [x] Update `server/storage.ts` import dari `storage.interface.ts`
- [x] Update semua ~40 module files import IStorage dari `storage.interface.ts` (bukan routes.ts)
- [x] Hapus re-export dari `routes.ts`
- [x] Verifikasi: server start tanpa error, semua API endpoints berfungsi
- [x] Pecah storage.ts (1463L → 172L facade) ke 6 domain repositories:
  - fleet.repository.ts (83L) — drivers, vehicles, layouts
  - network.repository.ts (70L) — stops, outlets
  - scheduling.repository.ts (833L) — trips, patterns, bases, stopTimes, legs, inventory, priceRules, manifest
  - booking.repository.ts (125L) — bookings, passengers, payments, printJobs
  - cargo.repository.ts (198L) — cargoTypes, cargoRates, cargoShipments
  - finance.repository.ts (123L) — costTemplates, costItems, promotions, vouchers

## Phase 3: Decentralize Routes
- [x] Tambahkan `registerXxxRoutes()` di setiap controller/module
- [x] Refactor `routes.ts` jadi orchestrator minimal
- [x] Verifikasi: semua API endpoints tetap berfungsi

## Phase 4: Pecah Komponen Frontend Besar
- [x] Pecah TripBasesManager.tsx (1143L → 579L) → TripBaseFormDialog (412L) + TripBaseGroupList (284L)
- [x] Pecah TripsManager.tsx (~960L → 801L) → TripsFilterPanel (252L)
- [x] Pecah CsoPage.tsx (~850L → 724L) → CsoCargoPanel (167L)
- [x] Verifikasi: semua halaman render dengan benar

## Phase 5: Performance Review
- [x] Review N+1 queries — 3 locations identified (app.service searchTrips, getAppUserBookings, storage getRealTripsForCso)
- [x] Review database indexes — 7 missing indexes documented
- [x] Review cache headers — no cache headers on any route; recommendations documented
- [x] Bundle observations — tree-shaking OK, lazy-load reports recommended
- [x] Documented in `plan/PERFORMANCE_REVIEW.md`

## Phase 6: Security Hardening
- [x] Reports gated per-flag (`report.revenue`, `report.commercial_fee`, dll)
- [x] Manifest endpoint dilindungi permission flag
- [x] Stop-time mutations dilindungi permission flag
- [x] Seed endpoints admin-only + diblokir di production
- [x] `DEV_BYPASS_AUTH` hardcoded `!IS_PRODUCTION`
- [x] Rate limiting: 10/min login, 5/min register (`@fastify/rate-limit`)
- [x] SPJ cost-line Zod validation (category, label, amount, notes)
- [x] CORS via `APP_CORS_ORIGINS` env var
- [x] Response logging redaction (token, password, session)
- [x] Passenger-detail endpoints dilindungi permission flag

## Phase 7: Data Integrity — Snapshot System
- [x] Tambah snapshot columns ke tabel `trips` (snap_route_name, snap_route_code, snap_driver_name, snap_vehicle_plate)
- [x] Tambah snapshot columns ke tabel `bookings` (snap_origin_stop_name, snap_destination_stop_name, snap_departure_hhmm, snap_outlet_name)
- [x] Populate snapshot saat materialisasi trip
- [x] Populate snapshot saat booking dibuat
- [x] Update semua query laporan dengan COALESCE(snapshot, master)
- [x] Impact check endpoints: `/api/stops/:id/impact`, `/api/trip-patterns/:id/impact`
- [x] Backfill script: `server/scripts/backfill-snapshots.ts`
- [x] Backfill data existing: 7 trips + 11 bookings

## Phase 8: Batch Reschedule on Trip Close
- [x] Permission flags: `action.trip.batch_reschedule`, `page.schedule.closed`, `page.cso.view_closed`
- [x] Backend: `GET /api/trips/:id/active-passengers`
- [x] Backend: `POST /api/trips/:id/close-with-reschedule`
- [x] Frontend: `BatchRescheduleDialog` component
- [x] CSO close trip flow: cek penumpang aktif → dialog → reschedule
- [x] Schedule page: toggle filter untuk lihat closed trips (gated by permission)

## Phase 9: Commercial Fee Report
- [x] Backend: ReportsRepository (standalone, tidak via IStorage)
- [x] Perhitungan: 3% gross, 11% PPN, volume discount 0–15%
- [x] Frontend: report page + summary cards
- [x] Permission flag: `report.commercial_fee`
