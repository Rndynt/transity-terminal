# TransityTerminal — Multi-Stop Travel Management System

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
  lib/
    constants.ts   → Centralized constants (status maps, channel maps, formatters)
    api.ts         → API client
    queryClient.ts → React Query config
  components/
    shared/        → Reusable badge components (StatusBadges.tsx)

server/
  routes.ts        → IStorage interface + Express route definitions
  storage.ts       → DatabaseStorage implementation
  modules/
    pricing/       → PricingService + PricingController
    bookings/      → BookingsService + BookingsController + UnseatService
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

## Authentication (Realmio Integration)
- **Model**: Whitelabel — 1 operator = 1 TransityTerminal instance; semua instance auth ke 1 Realmio
- **Backend**: `server/modules/auth/realmio.ts` (middleware), `server/modules/auth/auth.routes.ts` (proxy routes)
- **Frontend**: `client/src/lib/auth.tsx` (AuthProvider + useAuth), `client/src/pages/auth/LoginPage.tsx`
- **Dev Mode**: Jika `AUTHCORE_BASE_URL` kosong atau `DEV_BYPASS_AUTH=true`, login auto-sukses dengan user dev
- **Env Vars**: `AUTHCORE_BASE_URL`, `AUTHCORE_TENANT_ID`, `DEV_BYPASS_AUTH`
- **Endpoints**: `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`, `/api/auth/session`, `/api/auth/me`
- **Protected Routes**: Semua route CSO dashboard wrapped dalam `ProtectedRoute` — redirect ke `/login` jika belum auth

## Reports Module
- **Shared Components**: `client/src/components/reports/` — ReportFilters (date range + presets + outlet/channel/route selectors), SummaryCards (metric cards grid), ReportPageLayout (page wrapper with loading state)
- **Backend**: `server/modules/reports/reports.service.ts` (SQL aggregation queries) + `reports.controller.ts` (REST handlers)
- **API Endpoints**: `/api/reports/filter-options`, `/api/reports/revenue`, `/api/reports/sales`, `/api/reports/trip-profitability`, `/api/reports/load-factor`, `/api/reports/cancellations`, `/api/reports/cargo`, `/api/reports/payments`
- **Pages**: Revenue, Sales, Trip Profitability, Load Factor, Cancellations, Cargo, Payments — all at `/reports/*`
- **Sidebar**: "LAPORAN" section with 7 menu items between OPERASIONAL and MASTER DATA
- **ReportFilters**: SearchableSelect dropdowns + Collapsible filter panel + date presets
- **Plan Doc**: `plan/reports-plan.md` — P1+P2 done, P3 pending

## Recent Changes

**2026-03-21 — Realmio Auth Integration**
- Login page at `/login` with email/password form
- `AuthProvider` context wrapping entire app with session management
- `ProtectedRoute` wrapper — redirects unauthenticated users to login
- Sidebar shows user avatar + name + email + logout button
- Backend auth routes proxy to Realmio with `X-Tenant-Id` header injection
- `requireAuth` / `optionalAuth` middleware for protecting API routes
- Dev bypass mode: auto-login when Realmio is unavailable

**2026-03-21 — Reason Notes + Auto-Cancel Timer for Action Modes**
- **Mandatory Reason Notes**: All destructive actions (unseat, reschedule, cancel/batal tiket) now require a reason/note field before executing. Backend validates and rejects requests without reasons.
- **Unseat**: PassengerDetailModal and AllBookingsPage show textarea for reason in confirmation step. AllBookingsPage "Unseat Semua" also requires reason.
- **Cancel Tiket (Batal)**: New "Batalkan Tiket" button in PassengerDetailModal with confirmation + reason textarea. Backend `PATCH /api/passengers/:id/cancel` now properly releases seat inventory legs, updates booking status if all passengers inactive, records accurate `previousStatus` in booking history, and emits WebSocket updates.
- **Reschedule**: Reason collected in PassengerDetailModal before entering reschedule mode (step: click Reschedule → fill reason → "Lanjut Pilih Trip & Kursi"). Reason stored in `RescheduleModeState`, displayed in SeatMap purple banner, passed to API and recorded in booking history.
- **Auto-Cancel Timer (ModeTimer)**: Assign mode and Reschedule mode auto-cancel after 60 seconds of inactivity. Circular SVG progress ring with countdown number shown in banner. CSO can also manually cancel via X button. Toast notification on auto-expire.
- **`passengersApi.cancelTicket()`**: New frontend API function for cancel tiket with reason.
- **State Hygiene**: Assign/reschedule mode states reset when CsoPage outlet changes.

**2026-03-21 — Unseat & Reschedule + Bug Fixes**
- **Schema**: Added `unseated` to `bookingStatusEnum` and `ticketStatusEnum`; new `booking_history` table for audit trail (action enum: unseated/reassigned/rescheduled/canceled/status_change)
- **Backend**: `UnseatService` (`server/modules/bookings/unseat.service.ts`) — unseatPassenger, unseatAllPassengers, reassignSeat, reschedulePassenger, assignSeatToUnseated; all operations transactional with seat_inventory updates and WebSocket broadcasts
- **Bug Fix — Assign Unseated**: New `assignSeatToUnseated` service method + API endpoint `POST /api/passengers/:passengerId/assign-seat` allows re-assigning seats to unseated passengers. UI buttons added in both `PassengerDetailModal` and `AllBookingsPage` with orange notice banner for awareness
- **Unseated Passengers Panel in SeatMap**: `GET /api/trips/:id/unseated-passengers` endpoint + `storage.getUnseatedPassengers()`. SeatMap now shows a collapsible orange panel listing unseated passengers for the current trip with "Assign" buttons. Clicking assign enters assign mode (green seats clickable). Panel hidden during assign mode and on past trips buttons are disabled. AllBookingsPage assign flow also navigates to `/cso?...&assignPassengerId=&assignPassengerName=` with global banner at CsoPage level
- **Bug Fix — Seat Hold Expiry**: `useSeatHold` hook now accepts `onHoldExpired` callback; on timer expiry it (1) removes seat from local state, (2) calls backend `holdsApi.release()`, (3) triggers `onSeatDeselect` + seatmap refetch in SeatMap so the seat visually returns to available
- **API Routes**: `POST /api/passengers/:passengerId/unseat`, `POST /api/passengers/:passengerId/reassign`, `POST /api/passengers/:passengerId/reschedule`, `POST /api/bookings/:bookingId/unseat-all`, `GET /api/bookings/:bookingId/history`
- **Frontend**: PassengerDetailModal (CSO seat map click) has Unseat and Pindah Kursi buttons per passenger; AllBookingsPage BookingDetailModal has per-passenger Unseat/Reassign + Unseat All + Booking History timeline
- **Manifest**: Unseated passengers/bookings excluded from manifest queries

**2026-03-21 — Deep-Link All Bookings → CSO**
- **"Buka di Reservasi" button** in AllBookingsPage `BookingDetailModal` — navigates to `/cso?tripId=&outletId=&date=&originStopId=&destinationStopId=`
- **Full auto-selection**: CsoPage reads all URL params → TripSelector auto-selects outlet+trip → RouteTimeline auto-selects origin (Naik) + destination (Turun) stops → auto-proceeds to booking phase with seat map visible
- **RouteTimeline** enhanced: accepts `initialOriginStopId`, `initialDestinationStopId`, `onInitialRouteConsumed` props for programmatic route selection
- Flow: AllBookings → click booking row → modal → "Buka di Reservasi" → CSO page with everything pre-selected → seat map immediately visible

**2026-03-21 — Jadwal Harian (Unified Daily Schedule)**
- **New page**: `client/src/pages/schedule/SchedulePage.tsx` — unified operational hub at `/schedule`
  - Shows all trips for a selected date with consistent date navigation (chevron arrows, "Hari Ini", date picker)
  - **Driver assignment** inline: click driver badge to open assignment dialog (SearchableSelect), can assign/change/remove driver
  - **Manifest** access: "Manifest" button on each trip card opens ManifestDialog
  - **SPJ creation**: "Buat SPJ" button on each trip card, shows status if SPJ already exists
  - Summary badges: total trips, trips without driver, trips without SPJ
- **Sidebar reorganized**: "Manifest" replaced by "Jadwal Harian" in OPERASIONAL section; SPJ page still available separately for SPJ management/detail views
- **SPJ page**: Create dialog date navigation updated to match consistent chevron style

**2026-03-21 — SPJ (Surat Perintah Jalan) & Driver Assignment**
- **Database**: `spj` table (spj_number, trip_id, driver_id, vehicle_id, status enum draft/issued/on_trip/settled) + `spj_cost_lines` table (category from cost_item_category enum, estimated/actual amounts, is_advance flag)
- **Backend**: `SpjService` (create SPJ from trip with auto-populated cost lines from templates, issue, settle, CRUD cost lines, trip profit calculation) + `SpjController` — routes at `/api/spj/*`
- **SPJ Page**: `/spj` route — list view with search, detail view with trip/driver/vehicle info cards, financial summary (revenue/costs/profit), cost line table with inline editing, add/delete cost lines, settlement calculation, issue/settle actions
- **Driver Assignment**: Trip form now includes driver select (SearchableSelect), driver shown in trip list table and mobile cards ("Belum ditugaskan" badge when unassigned)
- **Buat SPJ**: Dedicated "Buat SPJ" button on SPJ page opens trip picker dialog (date navigation + search); also available as shortcut in trip row action menus
- **Sidebar**: Reorganized — "OPERASIONAL" section (Reservasi, Kargo, All Bookings, Manifest, SPJ) and "MASTER DATA" section; SPJ accessible directly from operations, not restricted to masters
- **Files**: `server/modules/spj/`, `client/src/pages/spj/SpjPage.tsx`, `client/src/components/masters/TripsManager.tsx`, `shared/schema.ts`

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
- Rule JSON: `{ pricingMode, basePricePerLeg, currency, multiplier }`
- `pricingMode`: `per_leg` (default, harga × jumlah leg × multiplier) atau `flat` (tarif tetap × multiplier, berapa pun jumlah leg)
- Trip tanpa price rule: disabled di CSO, tidak bisa dipesan

### Seat Management
- `seat_inventory`: pre-computed per seat per leg
- `seat_holds`: temporary hold saat CSO pilih kursi (TTL-based)
- WebSocket broadcast saat inventory berubah
