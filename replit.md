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

### Frontend Architecture
Pages interact with components, which utilize hooks, API clients, and React Query for data management. Real-time updates are handled via WebSockets.
- **Pages**: Top-level layout and state management.
- **Components**: Reusable UI elements.
- **Hooks**: Encapsulate shared logic (e.g., booking flow, seat hold, WebSocket).
- **API Client**: Grouped API functions for backend communication.
- **React Query**: Manages server state, caching, and invalidation.
- **UI/UX**: Utilizes Tailwind CSS and shadcn/ui for consistent styling. All interactive elements and data displays require `data-testid` attributes. Routing is handled by `wouter`, with pages lazy-loaded.

### Feature Specifications
- **CSO Booking Terminal**: Interactive seat map with real-time updates, multi-phase booking flow, unseat/reschedule/cancel functionalities, promo code support.
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

## Performance Optimizations
- **`getActiveBookingsForTrip`**: Filters bookings at DB level (WHERE status IN active statuses) instead of fetching all then filtering in memory. Used by getSeatmap and getSeatPassengerDetails.
- **Virtual trip price rules**: Uses targeted `SELECT WHERE pattern_id IN (...)` + Set membership check instead of loading ALL price rules.
- **Database indexes**: Composite indexes on `passengers(booking_id, seat_no)`, `seat_inventory(trip_id, leg_index)`, `bookings(trip_id, status)`, `seat_holds(trip_id, expires_at) WHERE booking_id IS NULL`.
- **Polling fallback**: TripSelector polls every 30s as backup; WebSocket provides instant updates for most events.