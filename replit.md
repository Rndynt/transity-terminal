# Bus Travel Ticketing System

## Overview
A comprehensive production-grade MVP for a multi-stop bus travel ticketing system with customer service operator (CSO) interface and master data management capabilities.

## Project Structure
- **Frontend**: React + TypeScript with Vite build system
- **Backend**: Express.js + TypeScript server
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Tailwind CSS + shadcn/ui components

## Recent Changes
**Date: 2026-03-19 — Fase 2: Manifest Perjalanan (Update)**
- DB: `manifest_first_printed_at` column added to `trips` table — records first print timestamp (idempotent)
- Backend: `recordManifestPrint(tripId)` in storage.ts — COALESCE update, only sets on first call
- Backend: `POST /api/trips/:id/manifest/print` endpoint added to routes.ts
- Backend: `getManifestFull` now returns `firstPrintedAt` in header
- Frontend: `ManifestDialog.tsx` fully updated — shows "Cetak Pertama" timestamp (green badge if printed, amber if not)
- Frontend: "Cetak Manifest" button calls recordPrint API first, then window.print(); invalidates manifest query
- Print format: thermal printer (80mm roll paper) — `@page { size: 80mm auto }` in CSS
- ThermalManifest component: monospace text layout (plain text, dashes separator) rendered only when printing
- `manifestApi.recordPrint()` added to api.ts
- Plan doc updated: Fase 2 fully done

**Date: 2026-03-19 — Fase 2: Manifest Perjalanan (Initial)**
- Backend: `getManifestFull(tripId)` in storage.ts — returns complete manifest JSON (header + passengers + cargo + summary)
- Manifest header includes: manifestNumber (MNF-{tripId}-{date}), serviceDate, departureTime, routeName, originStop, destinationStop, vehiclePlate, vehicleType, driverName, driverLicense
- Cargo section: queries `cargo_shipments` per trip with origin/destination stop names
- Summary: totalPassengers, totalCargoItems, totalCargoWeight, totalTicketRevenue, totalCargoRevenue, totalRevenue
- `ManifestFull`, `ManifestCargoEntry` interfaces added to routes.ts; `IStorage.getManifestFull()` added
- Frontend: `ManifestDialog.tsx` created at `client/src/components/manifest/`
- ManifestDialog: full manifest view with Section A (penumpang) + Section B (kargo) + summary cards + Cetak/PDF button
- TripsManager.tsx: "Lihat Manifest" added to action menu (first item), imports ManifestDialog
- api.ts: `manifestApi.get(tripId)` added

**Date: 2026-03-17**
- Transity Mobile App (B2C marketplace) — Expo React Native app scaffolded in `apps/mobile/`
- Schema: `app_users` table (email, passwordHash, name, phone, avatar), `reviews` table (appUserId, tripId, rating, comment), `appUserId` column added to `bookings`
- Backend: `/api/app/` namespace with JWT auth (bcryptjs + jsonwebtoken), AppService (register/login/profile, city search, trip search, seatmap, bookings CRUD, reviews, cargo tracking), AppController with Zod validation
- Mobile app architecture: Expo Router v4 (file-based routing), TanStack Query v5, Zustand auth store with SecureStore
- Screens: Home (search widget + popular cities), SearchResults, TripDetail (route timeline + reviews), SelectSeats (interactive seatmap), BookingConfirm (passenger data + payment method), BookingDetail (status tracking), ETicket (QR code per passenger), MyTrips, Cargo (waybill tracking with progress stepper), Profile (edit profile + menu)
- Auth flow: Login/Register screens with JWT token persistence via expo-secure-store
- API client: `apps/mobile/src/lib/api.ts` with auth/trips/bookings/reviews/cargo modules

**Date: 2026-03-16**
- TransityTerminal Cargo Terminal (Pengiriman Paket) fully implemented
- Database: `cargo_types` + `cargo_rates` + `cargo_shipments` tables; `cargo_status` enum with full lifecycle (pending→received→loaded→in_transit→arrived→delivered/returned, any→canceled)
- Schema: cargo_shipments includes dimensions (length/width/height_cm), declaredValue, cargoTypeId FK
- Backend: `server/modules/cargo/` (service + controller), IStorage interface + DatabaseStorage with cargo types/rates/shipments CRUD
- Cargo service: waybill generation with collision-safe retry (TRN-YYYYMMDD-XXXXX), server-side tariff calculation (rate * weight, min charge), status transition validation using enum values
- Cargo types/rates: CRUD APIs for managing cargo categories and per-route pricing; tariff quote endpoint for real-time pricing preview
- Frontend: CargoForm.tsx (with cargo type selector, dimensions, declared value, auto-tariff from rates), CargoWaybillPreview.tsx, CargoListPage.tsx (with stop names, date filter, status change confirmation dialog)
- Masters tabs in MastersPage.tsx: CargoTypesManager and CargoRatesManager as "Jenis Kargo" and "Tarif Kargo" tabs (no standalone routes)
- CsoPage: Penumpang/Kargo mode switcher in book phase
- Sidebar: Kargo under OPERATIONS; Jenis Kargo & Tarif Kargo under MASTERS (pointing to /masters?tab=cargo-types and cargo-rates)
- API routes: cargo-types, cargo-rates, cargo (shipments), cargo/quote-tariff
- Migration: migrations/0001_cargo_tables.sql covers all cargo tables + enum

**Date: 2026-03-15**
- Implemented TransitPro mockup design into production CSO booking terminal
- CsoPage.tsx rewritten with 2-phase layout: select phase (TripSelector + RouteTimeline) and book phase (SeatMap + PassengerForm with inline payment)
- Replaced stepper-based 3-column layout with breadcrumb navigation + 2-panel split
- PassengerForm updated: compact horizontal row layout, max 4 visible with scroll, green highlight when filled, inline payment section with method selection
- TripSelector updated: search filtering by route/vehicle, collapsible route groups
- useBookingFlow hook updated: uses stateRef for latest state access, booking functions accept optional overrides to prevent race conditions
- PaymentPanel no longer used directly from CsoPage (payment integrated into PassengerForm)
- Both booking paths functional: "Booking Saja" (pending) and "Bayar & Cetak" (paid)

**Date: 2025-09-27**
- Fresh GitHub import successfully reconfigured for Replit environment
- PostgreSQL database provisioned and connected via Replit database integration
- Database schema applied successfully using `npm run db:push`
- Database seeded with comprehensive sample data
- Workflow "Start application" configured to run `npm run dev` on port 5000 with webview output
- Application running successfully with all features functional
- Deployment configuration set up for autoscale target

## Project Architecture
- **Client**: `/client` directory with React frontend (CSO/admin) and Vite configuration
- **Server**: `/server` directory with Express backend, routes, and services
- **Shared**: `/shared` directory containing common TypeScript schemas
- **Database**: Neon PostgreSQL with Drizzle ORM migrations
- **Mobile**: `/apps/mobile` directory with Expo React Native app (B2C customer-facing)

## Key Features
- Multi-stop bus route management
- Seat inventory and booking system
- Customer service operator interface
- Master data management (stops, outlets, vehicles, layouts, trip patterns)
- Real-time seat availability tracking
- Pricing rules engine
- Payment processing and ticket printing

## Environment Setup
- Node.js with TypeScript execution via tsx
- Vite dev server configured with `allowedHosts: true` for Replit proxy
- Express server serves both API routes and static frontend
- Database configured with environment variables (DATABASE_URL, etc.)

## Running the Application
- Workflow: "Server" runs `npm run dev` on port 5000
- Development server serves both backend API and frontend
- Database schema applied via `npm run db:push`
- Sample data available via seed script

## Deployment
- Target: Autoscale deployment
- Build: `npm run build` 
- Start: `npm run start`
- Production-ready Express server with static file serving