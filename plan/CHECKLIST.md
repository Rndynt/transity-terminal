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
- [ ] (Optional) Pecah storage.ts ke domain repositories — deferred, low ROI vs risk

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
