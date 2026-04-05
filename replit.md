# TransityTerminal — Multi-Stop Travel Management System

## Overview
TransityTerminal is a multi-stop travel management system designed for Indonesian bus/travel operators. It provides a comprehensive suite of features including a CSO reservation terminal, trip scheduling, cargo management, dynamic pricing rules, real-time seat management via WebSockets, trip manifest (SPJ) generation, various reporting functionalities, and a robust Role-Based Access Control (RBAC) system. The project aims to streamline operations, enhance customer experience, and provide critical business insights for travel operators in Indonesia.

## User Preferences
I prefer clear and direct communication. When implementing new features or making significant changes, please propose the high-level approach first. For code, I appreciate clean, maintainable TypeScript following established architectural patterns. Ensure all new features include necessary RBAC definitions and comprehensive testing. Do not make changes to files within the `docs/` folder.

## System Architecture

### Core Design Principles
The system follows a layered architecture, separating concerns into distinct modules for maintainability and scalability. Key architectural patterns include:
- **API-first approach**: Clear separation between frontend and backend.
- **Domain-driven design**: Modules are organized by business domain (e.g., `fleet`, `network`, `scheduling`).
- **Soft Delete**: All master data tables implement soft deletion using a `deletedAt` timestamp column to preserve historical data.
- **Snapshot System**: Historical accuracy for reports is maintained through snapshot columns on `trips` and `bookings`, capturing data at the time of transaction.
- **Virtual vs. Real Trips**: A distinction is made between `Trip Base` (template schedules) and `Real Trips` (materialized instances in the database), with `Virtual Trips` appearing in the CSO based on `Trip Bases`.

### Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Fastify 5 + TypeScript (tsx)
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Real-time**: Socket.io WebSocket
- **Mobile**: Expo React Native (B2C) in `/apps/mobile`

### Backend Architecture
Requests flow through `Fastify Route` → `preHandler middleware` (auth, RBAC) → `Controller` → `Service` → `Repository` → `Database`. A `storage.ts` facade provides an `IStorage` interface, delegating calls to domain-specific repositories.
- **Routes**: Define HTTP endpoints.
- **Controllers**: Handle request parsing, input validation, service invocation, and response formatting.
- **Services**: Encapsulate business logic, orchestrate repository calls, and manage transactions.
- **Repositories**: Contain raw SQL/Drizzle queries, typically one per domain.
- **Modules**: Organize business logic and API controllers by domain (e.g., `auth`, `bookings`, `cargo`).

### Performance Optimizations (April 2026)
All 13 issues from `PERFORMANCE_AUDIT.md` have been resolved:
- **N+1 queries eliminated**: `confirmSeatsBooked`, `checkSeatsAvailable`, `createSeatHoldsForBooking`, `releaseHoldsByOwner`, `getUserBookings`, `processPaymentWebhook`, `cancelBooking`, `getTripDetail`, `searchRealTrips`, `searchVirtualTrips` — all converted to bulk `inArray` operations.
- **Parallel validation**: `createBooking` runs 4 validations via `Promise.all`; `getBookingById` merges sequential fetches into one batch.
- **Scheduler**: Uses `FOR UPDATE SKIP LOCKED` + bulk delete; orphan cleanup uses `NOT EXISTS` subquery.
- **WS emit**: Moved outside transactions in `atomicHold.service.ts` and `holds.service.ts`.
- **Deadlock prevention**: `roundTrip.service.ts` acquires `pg_advisory_xact_lock` in sorted trip ID order.
- **Database indexes**: 9 new indexes on `seat_inventory(hold_ref)`, `seat_holds(booking_id, trip_seat)`, `payments(provider_ref, paid_at)`, `print_jobs(booking_id)`, `booking_groups(created_at)`, `cashier_sessions(outlet_id+status, staff_id)`.

### Frontend Architecture
Pages interact with components, which utilize hooks, API clients, and React Query for data management. Real-time updates are handled via WebSockets.
- **Pages**: Top-level layout and state management.
- **Components**: Reusable UI elements.
- **Hooks**: Encapsulate shared logic (e.g., booking flow, seat hold, WebSocket).
- **API Client**: Grouped API functions for backend communication.
- **React Query**: Manages server state, caching, and invalidation.
- **UI/UX**: Utilizes Tailwind CSS and shadcn/ui for consistent styling. All interactive elements and data displays require `data-testid` attributes. Routing is handled by `wouter`, with pages lazy-loaded.

### Seed Data
Seed files are split by context in `server/seeds/`:
- `01-stops` — Stops & outlets
- `02-layouts` — Seat layouts
- `03-vehicles` — Vehicles
- `04-patterns` — Trip patterns & pattern stops
- `05-prices` — Price rules
- `06-tripbases` — Trip base schedules
- `07-cargo` — Cargo types & rates
- `08-trips` — Materialize trips (30 days)
- `09-rbac` — Roles, feature flags, matrix

Run all: `npx tsx server/seeds/index.ts`
Run specific: `npx tsx server/seeds/index.ts rbac` (auto-resolves dependencies)
Help: `npx tsx server/seeds/index.ts --help`
Legacy `server/seed.ts` still works (delegates to `server/seeds/index.ts`).

### Feature Specifications
- **CSO Booking Terminal**: Interactive seat map with real-time updates, multi-phase booking flow, unseat/reschedule/cancel functionalities, promo code support. Supports two booking modes:
  - **Sekali Jalan (Single)**: Standard one-way booking flow — Outlet → Trip → Route → Seats → Passengers → Payment → Print.
  - **Pulang Pergi / PP (Round Trip)**: Two-trip booking in a single transaction. Uses `useRoundTripFlow` hook and `RoundTripStepper` (4 steps: Pergi → Pulang → Penumpang → Selesai). Both outbound and return seat holds must be active before submission. Submits to `POST /api/bookings/round-trip`, which validates equal passenger counts, validates boarding/alighting rules for both trips, and creates two linked bookings in a `booking_groups` record with a shared `groupCode`. Prints via `RoundTripPrintPreview` showing both booking codes and group code.
- **Cargo Management**: Tracks cargo types, rates, and shipments; generates waybills; calculates tariffs. Cargo Terminal uses own `/api/cargo/available-trips` endpoint (origin+destination stop-based) with pattern_stops fallback for trip_stop_times, filters virtual trips (only real/materialized shown), and listens to WebSocket events for real-time schedule updates.
- **Daily Schedule**: Displays all trips for a given date, allows inline driver assignment, and provides access to manifests and SPJ creation.
- **SPJ (Surat Perintah Jalan)**: Manages trip manifests with auto-populated cost lines from templates and a Draft → Issued → Settled workflow.
- **Reports**: Eight types of analytical reports (Revenue, Sales, Trip Profitability, Load Factor, Cancellations, Cargo, Payments, Commercial Fee), relying on snapshot data for historical accuracy.
- **Batch Reschedule**: Allows rescheduling active passengers when a trip is closed.
- **Master Data Management**: CRUD operations for stops, trip patterns, schedules, drivers, vehicles, layouts, outlets, price rules, cargo types, rates, cost templates, promotions, and vouchers.

### Authentication and Authorization
- **Staff/Admin**: Integrated with Realmio external authentication via a proxy.
- **Mobile App**: Uses internal JWT for authentication.
- **RBAC + ABAC + Feature Flags**: A granular permission system with 7 roles and 36+ permission flags across 5 categories (page, report, master, action, admin). This controls access at both backend (middleware) and frontend levels. Refund permissions: `action.refund.create` (owner/manager/spv_cso/cso), `action.refund.approve` (owner/finance/manager), `action.refund.process` (owner/finance/manager).

## Operator Settings & Branding
Each terminal instance has customizable branding via `/admin/settings`:
- **Brand name & tagline** displayed in sidebar
- **Logo** (URL-based)
- **Primary, secondary, accent colors** for UI theming
- Stored in `operator_settings` table (auto-created on first access)
- Sidebar reads settings via `GET /api/settings` with 5-min stale cache
- Default fallback: "Transity" / "Multi-Stop Travel System" / blue (#2563EB)

## Deployment
See `DEPLOY.md` for full VPS deployment guide. Key points:
- Each operator gets own terminal instance + database + Realmio tenant
- Environment: `REALMIO_BASE_URL`, `REALMIO_TENANT_ID`, `DATABASE_URL`
- `.env.example` provided as template
- Nginx reverse proxy per subdomain (e.g., `nusa-terminal.transity.web.id`)
- `apps/transityweb` is the OTA channel (separate deployment, ignore for terminal)

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database for all application data.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **Socket.io**: Powers real-time communication for seat inventory updates.
- **Realmio**: External authentication service used for staff and admin users.
- **Expo React Native**: Framework for the mobile B2C application.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **lucide-react**: Icon library for frontend UI.
- **react-icons/si**: Icon library for logos.
- **jsonwebtoken**: For JWT token management in the mobile API.
- **bcryptjs**: For password hashing in the mobile API.
- **Payment Gateway**: Webhook integration for payment verification (requires `PAYMENT_WEBHOOK_SECRET`).

## Import Path Aliases
The project uses TypeScript path aliases (configured in `tsconfig.json`, resolved by tsx at runtime and esbuild for production build via `esbuild.config.js`):
- `@shared/*` → `./shared/*` (shared schema, types)
- `@server/*` → `./server/*` (db, config, storage, realtime, utils, repositories)
- `@modules/*` → `./server/modules/*` (business domain modules)
- `@/*` → `./client/src/*` (frontend components, hooks, lib)

Examples: `@server/db`, `@server/config`, `@modules/rbac/rbac.middleware`, `@modules/bookings/booking.helpers`. No relative `../` or `../../` paths in server code.

## Booking Module Structure
- `bookings.service.ts` — `createBooking` (CSO paid), `createPendingBooking` (CSO pending), `createHold`, `releaseHold`
- `atomicHold.service.ts` — `AtomicHoldService`: `atomicHold()` (SELECT FOR UPDATE locking) and `releaseHoldByRef()`
- `booking.helpers.ts` — shared helpers used by CSO + App booking flows
- `app.service.ts` (in `/modules/app/`) — `createAppBooking` (Public API / third-party)

## Shared Booking Helpers
`server/modules/bookings/booking.helpers.ts` contains shared logic used by both CSO (`BookingsService`) and Public API (`AppService`) booking flows:
- `computeLegIndexes(originSeq, destSeq)` — computes seat-leg range
- `quoteFareForBooking(storage, tripId, originSeq, destSeq)` — pricing with error handling
- `calculateBookingTotal(storage, tripId, originSeq, destSeq, paxCount, channel?, promoCode?)` — full total calculation including promo/voucher validation and discount
- `fetchBookingSnapshots(storage, tripId, originStopId, destStopId, outletId?, originSeq?)` — fetches snapshot data (stop names, departure time, outlet name) with fallback to stop-time when `originDepartHHMM` is null
- `insertPassengerRows(tx, bookingId, passengers, fareQuote)` — inserts passengers with auto-generated ticket numbers
- `validateBoardingAlighting(storage, tripId, originSeq, destSeq)` — validates boarding/alighting rules including schedule exceptions
- `confirmSeatsBooked(tx, tripId, seatNos, legIndexes, operatorId)` — marks seats as booked in inventory and clears holds (CSO flow)
- `checkSeatsAvailable(tx, tripId, seatNos, legIndexes)` — checks seat availability with `FOR UPDATE` lock (App flow)
- `createSeatHoldsForBooking(tx, tripId, bookingId, seatNos, legIndexes, holderId, expiresAt)` — creates holds and sets holdRef on inventory (App flow)
- Re-exports `generateBookingCode` and `generateTicketNumber` from `utils/codeGenerator`

## Real-time WebSocket Architecture
The system uses Socket.io with room-based subscriptions for efficient event targeting:
- **Rooms**: `trip:{tripId}` (seat-level updates), `base:{baseId}` (materialization/status), `cso:{outletId}:{serviceDate}` (outlet-scoped CSO terminal updates).
- **Events emitted**: `INVENTORY_UPDATED`, `HOLDS_RELEASED`, `TRIP_STATUS_CHANGED`, `TRIP_CANCELED`, `TRIP_MATERIALIZED`, `STOP_EXCEPTION_CHANGED`.
- **Emitting pattern**: Events are scoped to relevant rooms only (trip, base, CSO rooms) — never use global broadcast for trip-specific events.
- **TripSelector subscriptions**: Subscribes to trip rooms (for real trips), base rooms (for virtual trips — to catch materialization), and CSO room (for outlet-scoped updates).
- **SeatMap subscriptions**: Subscribes to the specific trip room for real-time seat updates.

## New Modules (Phase 2)
The following modules were added with Controller-Service-Routes pattern:
- **Dashboard** (`/dashboard`): Operational summary — trips, bookings, revenue, cargo, load factor, alerts, recent bookings. Flag: `page.dashboard`.
- **Cashier** (`/cashier`): Open/close/approve daily cash sessions with settlement breakdown. Live transaction summary during active session (auto-refresh 30s). System amount auto-calculated from `payments` JOIN `bookings` filtered by outlet + session time range. Outlet ownership enforced on close/approve/detail. Flag: `page.cashier`.
- **Refunds** (`/refunds`): Create/approve/process/reject refund requests with booking code search autocomplete. Supports URL pre-fill (`?bookingId=&bookingCode=`). CSO can create refunds; manager/finance approve/process. Flags: `page.refunds`, `action.refund.create`, `action.refund.approve`, `action.refund.process`. Booking search endpoint: `GET /api/bookings/search?q=CODE`.
- **Customers** (`/customers`): CRM — customer profiles with tags (regular/vip/frequent/blacklist), booking history. Flag: `page.customers`.
- **Maintenance** (`/api/maintenance/*`): Vehicle maintenance records and alerts. Embedded in MastersPage vehicle detail.
- **Notifications**: Bell icon in header with real-time unread count, mark read/all, delete.
- **Driver Performance** (`/api/drivers/:id/performance`): Trip count, revenue, ratings per driver. Embedded in MastersPage driver detail.

### Key Patterns for New Modules
- Backend: `routes.ts` (thin, with `requireFlag` preHandler) → `controller.ts` → `service.ts` (uses `db.execute(sql)` for raw SQL)
- Frontend: `lib/api.ts` has domain API helpers (`customersApi`, `cashierApi`, etc.); `lib/constants.ts` has status maps (`REFUND_STATUS_MAP`, etc.)
- `payments` table uses `paid_at` (NOT `created_at`) — all queries referencing payment time must use `paid_at`
- `db.execute(sql)` returns `{rows:[]}` — always extract with: `Array.isArray(result) ? result : (result as any).rows || []`
- **booking_groups** table links round-trip (PP) booking pairs. Each group has a unique `groupCode` and references `outboundBookingId` + `returnBookingId`. Created atomically inside a DB transaction in `RoundTripService.createRoundTripBooking`.
- **PrintService** (`server/modules/printing/print.service.ts`) generates print job payloads for both single and round-trip tickets. Round-trip prints use `RoundTripPrintPreview` component on the frontend.
- **Scheduler** (`server/modules/scheduler/`): background cleanup job that runs every 1 minute — releases expired seat holds and cancels expired pending bookings. Registered at app startup. Not a cron dependency; uses `setInterval` internally.

## Security Audit Fixes (Sprint 0 — Completed)
Based on the Blink AI audit report (174 issues), the following critical/high security fixes have been applied:
- **C-04**: Added `await` on `isHoldOwnedByOperator()` — prevents promise-truthiness bypass
- **C-05**: Removed all `x-operator-id` header fallback patterns (10 locations) — prevents identity spoofing; all endpoints now use `req.user?.id ?? 'system'`
- **C-06**: Changed `payments.status` default from `'success'` to `'pending'` — correct payment lifecycle
- **C-10**: Added `assertOk<T>()` helper in `client/src/lib/api.ts` — all GET fetch calls now check `res.ok` before parsing JSON
- **H-04**: WebSocket CORS tightened from `"*"` to env-configurable `CORS_ORIGINS` (defaults to `true` in dev, `false` in prod)
- **H-05**: Hold delete (`DELETE /api/holds/:holdRef`) now validates ownership (404 if not found, 403 if not owner)
- **H-16**: `Math.random()` replaced with `crypto.randomBytes()` + rejection sampling (no modulo bias) in `codeGenerator.ts`
- **C-01**: `.env` parsing bug fixed (concatenated vars), `.gitignore` updated to exclude `.env`

## Quick Wins & Safety Fixes (Sprint 2 — Completed)
- **B7**: Payment validation changed from float comparison (`> 0.01`) to `Math.round()` comparison — correct for IDR (no decimals)
- **F3**: Mobile `avgRating.toFixed()` crash guarded with `?? 0` fallback
- **H-08**: React Query global `staleTime` changed from `Infinity` to 5 minutes — data now auto-refreshes
- **B8**: WebSocket `initialize()` guard added (`if (this.io) return`) — prevents duplicate listeners on hot reload
- **H-03**: Confirmed not applicable — auth uses session-based (not JWT) with 7-day expiry, already reasonable

## Data Integrity Fixes (Sprint 1 — Completed)
Following Sprint 0 security fixes, these data integrity issues from the Blink AI audit have been resolved:
- **C-02**: `createBooking` and `createPendingBooking` now use `tx.insert()` directly for all DB writes (booking, passengers, payment, print job) inside a single `db.transaction()`, eliminating partial-write risk from escaped transaction context
- **H-09**: Promo usage increment and voucher consumption moved inside the booking transaction with race-condition guards — conditional WHERE clauses check `isActive`, `usageCount < usageLimit`, and voucher `status='active'`; affected-row validation prevents double-redemption
- **H-02**: `releasePendingBooking` and `cleanupExpiredPendingBookings` now update booking status to 'canceled' inside the transaction; WebSocket emits happen only after successful commit
- **H-06**: `getPendingBookings` replaced in-memory filtering (loaded all bookings) with direct DB query using `WHERE status='pending' AND pendingExpiresAt > now`
- **H-11**: `deleteTrip` already validates active bookings at repository level (throws `TRIP_HAS_ACTIVE_BOOKINGS`); confirmed no service-level gap

## UI/UX & Type Safety Fixes (Sprint 3+4 — Completed)
- **F4**: Loading states added to TripsManager dropdown queries (patterns/vehicles/layouts/drivers) with disabled state and "Memuat..." placeholders
- **F5**: setTimeout cleanup fixed in RouteTimeline (useEffect return clearTimeout) and useWebSocket (reconnect timer ref + cleanup on disconnect)
- **F6**: SeatMap already had error state with retry button (confirmed existing)
- **F7**: RouteTimeline `any` types replaced with proper `EffectiveStopTime` type matching API contract (`effectiveBoardingAllowed`/`effectiveAlightingAllowed`)
- **F8**: useBookingFlow `any` types replaced — `PassengerInput` type for booking form, `BookingOverrides`/`BookingResult` type aliases, CsoPage callsites updated
- **S-4**: React `ErrorBoundary` component created (`shared/ErrorBoundary.tsx`) and integrated in `App.tsx` wrapping Router
- **S-6/R-7**: `LoadingState` and `EmptyState` shared components exist at `components/ui/loading-state.tsx` and `components/ui/empty-state.tsx`

## Public API (TransityConsole Integration)
The `/api/app/*` endpoints serve external systems (TransityConsole, third-party OTA). Auth via `X-Service-Key` header (env `TERMINAL_SERVICE_KEY`). Booking also accepts JWT Bearer for mobile users.

Key docs:
- `PUBLIC_API.md` — full endpoint reference for third-party developers
- `TRANSITY_CONSOLE_INTEGRATION.md` — step-by-step guide for TransityConsole integration

Endpoints verified end-to-end (search → seatmap → booking → payment webhook):
- `GET /api/app/operator-info` — brand info
- `GET /api/app/cities` — city list
- `GET /api/app/service-lines` — active routes
- `GET /api/app/trips/search` — trip search (real + virtual)
- `GET /api/app/trips/:id` — trip detail
- `GET /api/app/trips/:id/seatmap` — seat availability
- `POST /api/app/trips/materialize` — materialize virtual trip (service key auth, idempotent, race-safe)
- `POST /api/app/bookings` — create booking (supports virtual trip auto-materialization)
- `POST /api/app/payments/webhook` — payment confirmation (HMAC-SHA256)

Environment variables required:
- `TERMINAL_SERVICE_KEY` — service key for X-Service-Key auth
- `PAYMENT_WEBHOOK_SECRET` — HMAC secret for webhook verification

## Performance Optimizations
- **`getActiveBookingsForTrip`**: Filters bookings at DB level (WHERE status IN active statuses) instead of fetching all then filtering in memory. Used by getSeatmap and getSeatPassengerDetails.
- **Virtual trip price rules**: Uses targeted `SELECT WHERE pattern_id IN (...)` + Set membership check instead of loading ALL price rules.
- **Database indexes**: Composite indexes on `passengers(booking_id, seat_no)`, `seat_inventory(trip_id, leg_index)`, `bookings(trip_id, status)`, `seat_holds(trip_id, expires_at) WHERE booking_id IS NULL`.
- **Polling fallback**: TripSelector polls every 30s as backup; WebSocket provides instant updates for most events.