# Bus Travel Ticketing System

## Overview
A comprehensive production-grade MVP for a multi-stop bus travel ticketing system with customer service operator (CSO) interface and master data management capabilities.

## Project Structure
- **Frontend**: React + TypeScript with Vite build system
- **Backend**: Express.js + TypeScript server
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Tailwind CSS + shadcn/ui components

## Recent Changes
**Date: 2026-03-16**
- TransityTerminal Cargo Terminal (Pengiriman Paket) fully implemented
- Database: `cargo_types` + `cargo_rates` + `cargo_shipments` tables; `cargo_status` enum with full lifecycle (pending→received→loaded→in_transit→arrived→delivered/returned, any→canceled)
- Schema: cargo_shipments includes dimensions (length/width/height_cm), declaredValue, cargoTypeId FK
- Backend: `server/modules/cargo/` (service + controller), IStorage interface + DatabaseStorage with cargo types/rates/shipments CRUD
- Cargo service: waybill generation with collision-safe retry (TRN-YYYYMMDD-XXXXX), server-side tariff calculation (rate * weight, min charge), status transition validation using enum values
- Cargo types/rates: CRUD APIs for managing cargo categories and per-route pricing; tariff quote endpoint for real-time pricing preview
- Frontend: CargoForm.tsx (with cargo type selector, dimensions, declared value, auto-tariff from rates), CargoWaybillPreview.tsx, CargoListPage.tsx (with stop names via joined query)
- Masters: CargoTypesPage.tsx and CargoRatesPage.tsx for managing cargo types and route-based tariffs
- CsoPage: Penumpang/Kargo mode switcher in book phase
- Sidebar: Kargo under OPERATIONS; Cargo Types & Cargo Rates under MASTERS
- API routes: cargo-types, cargo-rates, cargo (shipments), cargo/quote-tariff

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
- **Client**: `/client` directory with React frontend and Vite configuration
- **Server**: `/server` directory with Express backend, routes, and services
- **Shared**: `/shared` directory containing common TypeScript schemas
- **Database**: Neon PostgreSQL with Drizzle ORM migrations

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