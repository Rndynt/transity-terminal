# Transity — Multi-Stop Travel Management System

## Overview
Sistem manajemen perjalanan multi-stop (bus/travel) dengan terminal reservasi CSO, penjadwalan trip, kargo, aturan harga, dan manajemen kursi real-time via WebSocket.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript (tsx)
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Real-time**: WebSocket (ws) untuk update kursi
- **Mobile**: Expo React Native (B2C) di `/apps/mobile`

## Project Structure
```
client/src/
  pages/           → Halaman utama (CsoPage, MastersPage, BookingsPage, dll)
  components/
    cso/           → Komponen terminal CSO (TripSelector, SeatMap, PassengerForm, RouteTimeline)
    masters/       → Komponen master data (StopsManager, TripPatternsManager, dll)
    manifest/      → ManifestDialog + ThermalManifest (cetak manifest)
  hooks/           → Custom hooks (useBookingFlow, useWebSocket, use-toast)
  lib/             → API client, queryClient

server/
  routes.ts        → IStorage interface + Express route definitions
  storage.ts       → DatabaseStorage implementation
  modules/
    pricing/       → PricingService + PricingController
    bookings/      → BookingsService + BookingsController
    tripBases/     → TripBasesService (materialisasi virtual → real)
    cargo/         → CargoService + CargoController
    seatInventory/ → SeatInventoryService
    tripLegs/      → TripLegsService

shared/
  schema.ts        → Drizzle table definitions + Zod schemas + shared types

plan/              → Dokumentasi teknis fitur
```

## Running
- Workflow "Start application" → `npm run dev` (port 5000)
- `npm run db:push` → sync schema ke database
- `npm run build` → production build

## Recent Changes

**2026-03-21 — Promo & Voucher System**
- **Database**: `promotions` table (code, type, discountValue, scope, validity, usage limits) + `vouchers` table (individual codes linked to promos)
- **Backend**: `PromosService` (validate, apply, generate vouchers), `PromosController` (REST endpoints), integrated into `BookingsService.createBooking` with `promoCode` support
- **Master Data UI**: `PromosManager.tsx` — CRUD promos with inline voucher generation/revocation, added "Promo & Voucher" tab in MastersPage
- **CSO Booking Flow**: Promo input in PassengerForm payment section, discount breakdown display, promo state cleared on context changes (outlet/trip/route change)
- **Booking Detail**: Discount amount + voucher code shown in AllBookingsPage detail modal
- **Schema**: `insertPromotionSchema` coerces date strings to Date objects; `discountAmount`/`promoId`/`voucherCode` columns on bookings table

**2026-03-21 — Critical Bug Fixes & UI Standardization**
- **Transaction Safety**: All multi-table writes in BookingsService now wrapped in `db.transaction()` (createBooking, releasePendingBooking, cleanupExpiredPendingBookings)
- **Holds Service Rewrite**: Removed in-memory Maps, all hold state is now DB-only; errors propagate correctly (no more swallowed catch blocks); WebSocket events only emitted on successful DB operations
- **Query Invalidation**: TripsManager.tsx now invalidates `['/api/trips']` after deriveLeg and precomputeSeatInventory mutations
- **parseInt Safety**: `parseInt(formData.capacity, 10) || 0` prevents NaN from empty string
- **tripId Guard**: bookings.controller.ts properly validates tripId query parameter type
- **Waybill Retry**: Increased from 5 to 20 attempts for unique waybill generation
- **setTimeout Cleanup**: TripSelector OutletSearchSelect properly clears timeout on unmount
- **CargoForm Loading**: Added loading state while stops/cargo-types queries are in-flight
- **Shared Components**: Created `LoadingState`, `EmptyState`, `StatusBadge` reusable UI components
- Applied shared components to AllBookingsPage, CargoListPage, ManifestPage

**2026-03-21 — Pricing Enforcement**
- Removed hardcoded `basePricePerLeg = 25000` fallback from PricingService
- Price must now come exclusively from price rules; a rule with value 0 is valid
- Added `getPriceRulesForTrip(tripId, patternId)` to IStorage + DatabaseStorage
- Added `hasPriceRule: boolean` to `CsoAvailableTrip` type (shared/schema.ts)
- `getRealTripsForCso`: SQL EXISTS subquery checks price_rules table
- `getVirtualTripsForCso`: checks allPriceRules for matching patternId
- PricingService: throws `NO_PRICE_RULE` error if no rule found
- PricingController: returns HTTP 422 with `code: 'NO_PRICE_RULE'`
- BookingsService: catches `NO_PRICE_RULE` and re-throws user-friendly message
- TripSelector.tsx: trips without price rules show red "Belum Ada Harga" badge, disabled & unclickable
- Plan doc: `plan/pricing-enforcement.md`

**2026-03-20 — CSO Trip Display Fixes**
- RouteTimeline: drop-only stops show `arriveAt` instead of `departAt`; "Berangkat" label hidden
- `getRealTripsForCso`: WHERE clause accepts both boarding AND alighting stops
- `getTripStopTimesWithEffectiveFlags`: fixed field naming (boardingAllowed/alightingAllowed canonical aliases)
- `OverridePill`: treats `undefined` same as `null` (grey/inherit pill)

**2026-03-19 — Manifest Perjalanan**
- Backend: `getManifestFull(tripId)` with complete manifest JSON
- Frontend: ManifestDialog + ThermalManifest (80mm thermal printer)
- Print flow: `POST /api/trips/:id/manifest/print` records first-print timestamp

**2026-03-16 — Cargo Terminal**
- `cargo_types`, `cargo_rates`, `cargo_shipments` tables
- Waybill generation (TRN-YYYYMMDD-XXXXX), tariff calculation, status lifecycle
- CargoForm, CargoWaybillPreview, CargoListPage components

**2026-03-15 — CSO Booking Terminal Redesign**
- 2-phase layout: select phase → book phase
- SeatMap, PassengerForm with inline payment
- WebSocket real-time seat updates

## Key Concepts

### Virtual vs Real Trips
- **Trip Base** = jadwal template (pola + hari + waktu default)
- **Virtual Trip** = tampil di CSO berdasarkan Trip Base, belum ada di database
- **Real Trip** = sudah di-materialize ke tabel `trips` dengan stop times, legs, seat inventory
- Saat CSO klik virtual trip → otomatis materialize → jadi real trip

### Pricing
- Price rules: scope `pattern | trip | leg | time`, prioritas tertinggi dipakai
- Rule JSON: `{ basePricePerLeg, currency, multiplier }`
- Total = basePricePerLeg × multiplier × jumlah leg
- Trip tanpa price rule: disabled di CSO, tidak bisa dipesan

### Seat Management
- `seat_inventory`: pre-computed per seat per leg
- `seat_holds`: temporary hold saat CSO pilih kursi (TTL-based)
- WebSocket broadcast saat inventory berubah
