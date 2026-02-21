# TransityCore

**Core Backend untuk Sistem Transit & Tiket Multi-Operator**

TransityCore adalah backend sistem ticketing bus transit multi-operator yang komprehensif, mendukung pengelolaan rute, perjalanan, kursi, pemesanan, dan harga dinamis. Sistem ini dirancang untuk operasional real-time dengan dukungan WebSocket untuk update inventaris kursi secara live.

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Tech Stack](#-tech-stack)
- [Struktur Database](#-struktur-database)
- [Instalasi](#-instalasi)
- [Konfigurasi](#-konfigurasi)
- [API Endpoints](#-api-endpoints)
- [Alur Booking](#-alur-booking)
- [Virtual Scheduling](#-virtual-scheduling)
- [Real-time Events](#-real-time-events)
- [Struktur Project](#-struktur-project)
- [Pengembangan](#-pengembangan)
- [Status Fitur](#-status-fitur)

---

## 🚀 Fitur Utama

### Master Data Management
- **Stops** - Pengelolaan titik berhenti/terminal dengan koordinat GPS
- **Outlets** - Lokasi penjualan tiket dengan konfigurasi printer
- **Vehicles** - Armada bus dengan kapasitas dan layout kursi
- **Layouts** - Konfigurasi layout kursi (grid-based seat map)
- **Trip Patterns** - Definisi pola rute dengan urutan pemberhentian
- **Price Rules** - Aturan harga dinamis (pattern/trip/leg/time-based)

### Trip Operations
- **Trip Bases** - Template penjadwalan virtual dengan hari operasional
- **Trips** - Instance perjalanan aktual dengan materialisasi on-demand
- **Trip Legs** - Segmen perjalanan antar stop
- **Seat Inventory** - Inventaris kursi per segmen (segment-aware)

### Booking System
- **Seat Hold** - Reservasi kursi sementara dengan TTL (Time-To-Live)
- **Pricing Engine** - Kalkulasi harga dinamis berdasarkan aturan
- **Multi-passenger Booking** - Pemesanan multi-penumpang dalam satu transaksi
- **Payment Integration** - Dukungan cash, QR, e-wallet, bank transfer
- **Print Job Queue** - Antrian cetak tiket thermal

### Real-time Features
- **WebSocket Server** - Update inventaris real-time
- **Room Subscriptions** - Subscribe ke trip/base/CSO room
- **Event Broadcasting** - Status trip, inventory update, hold release

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   CSO    │  │ Masters  │  │  Hooks   │  │   UI     │        │
│  │   Page   │  │   Page   │  │ (State)  │  │Components│        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │              │              │
│       └─────────────┴─────────────┴──────────────┘              │
│                           │                                      │
│                    React Query + Wouter                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Express + TypeScript)               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Routes Layer                          │   │
│  │  /api/stops  /api/trips  /api/bookings  /api/holds ...  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                  Controllers Layer                       │   │
│  │  StopsCtrl  TripsCtrl  BookingsCtrl  PricingCtrl ...    │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                   Services Layer                         │   │
│  │  BookingsService  PricingService  TripBasesService ...  │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                  Storage Layer (IStorage)                │   │
│  │              DatabaseStorage (Drizzle ORM)               │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                 WebSocket Service                        │   │
│  │        Socket.IO (Real-time Event Broadcasting)          │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
│  stops | outlets | vehicles | layouts | trip_patterns |         │
│  pattern_stops | trip_bases | trips | trip_stop_times |        │
│  trip_legs | seat_inventory | seat_holds | price_rules |       │
│  bookings | passengers | payments | print_jobs                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon Serverless compatible)
- **Real-time**: Socket.IO
- **Validation**: Zod + drizzle-zod

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **UI Components**: Radix UI + shadcn/ui
- **Icons**: Lucide React

### Development
- **Package Manager**: npm
- **Type Checking**: TypeScript 5.6
- **Bundler**: esbuild (production), Vite (development)

---

## 📊 Struktur Database

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    stops    │────<│   outlets   │     │   layouts   │
└──────┬──────┘     └─────────────┘     └──────┬──────┘
       │                                       │
       │     ┌─────────────────┐               │
       └────<│  pattern_stops  │               │
             └────────┬────────┘               │
                      │                        │
┌─────────────┐       │     ┌─────────────┐    │
│trip_patterns│───────┴────<│   vehicles  │<───┘
└──────┬──────┘             └──────┬──────┘
       │                           │
       │     ┌─────────────┐       │
       └────<│  trip_bases │       │
             └──────┬──────┘       │
                    │              │
             ┌──────▼──────┐       │
             │    trips    │<──────┘
             └──────┬──────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼───────┐   │   ┌───────▼───────┐
│trip_stop_times│   │   │   trip_legs   │
└───────────────┘   │   └───────┬───────┘
                    │           │
             ┌──────▼──────┐    │
             │seat_inventory│<──┘
             └──────┬──────┘
                    │
             ┌──────▼──────┐
             │  seat_holds │
             └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  bookings   │────<│ passengers  │     │  payments   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
┌──────▼──────┐
│ print_jobs  │
└─────────────┘
```

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `stops` | Titik berhenti/terminal bus |
| `outlets` | Lokasi penjualan tiket |
| `layouts` | Konfigurasi layout kursi |
| `vehicles` | Armada bus |
| `trip_patterns` | Pola rute (template) |
| `pattern_stops` | Urutan stop dalam pola |
| `trip_bases` | Template penjadwalan virtual |
| `trips` | Instance perjalanan aktual |
| `trip_stop_times` | Jadwal kedatangan/keberangkatan |
| `trip_legs` | Segmen perjalanan antar stop |
| `seat_inventory` | Ketersediaan kursi per segmen |
| `seat_holds` | Reservasi kursi sementara |
| `price_rules` | Aturan harga dinamis |
| `bookings` | Data pemesanan |
| `passengers` | Data penumpang |
| `payments` | Data pembayaran |
| `print_jobs` | Antrian cetak tiket |

---

## 📦 Instalasi

### Prasyarat
- Node.js 18+
- PostgreSQL 14+ (atau Neon Serverless)
- npm atau yarn

### Langkah Instalasi

```bash
# Clone repository
git clone https://github.com/Rndynt/TransityCore.git
cd TransityCore

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env dengan konfigurasi database Anda

# Push schema ke database
npm run db:push

# (Opsional) Seed data demo
curl -X POST http://localhost:5000/api/seed

# Jalankan development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:port/database
PORT=5000
HOLD_TTL_SHORT_SECONDS=60
HOLD_TTL_LONG_SECONDS=1200
PENDING_BOOKING_AUTO_RELEASE=true
```

---

## ⚙️ Konfigurasi

### Konfigurasi Aplikasi (`server/config.ts`)

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `HOLD_TTL_SHORT_SECONDS` | 60 | TTL hold singkat (detik) |
| `HOLD_TTL_LONG_SECONDS` | 1200 | TTL hold panjang (20 menit) |
| `PENDING_BOOKING_AUTO_RELEASE` | true | Auto-cleanup booking pending |

### Drizzle Config (`drizzle.config.ts`)

```typescript
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

---

## 🔌 API Endpoints

### Master Data

```http
# Stops
GET    /api/stops           # List semua stops
GET    /api/stops/:id       # Detail stop
POST   /api/stops           # Buat stop baru
PUT    /api/stops/:id       # Update stop
DELETE /api/stops/:id       # Hapus stop

# Outlets
GET    /api/outlets
GET    /api/outlets/:id
POST   /api/outlets
PUT    /api/outlets/:id
DELETE /api/outlets/:id

# Vehicles
GET    /api/vehicles
GET    /api/vehicles/:id
POST   /api/vehicles
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id

# Layouts
GET    /api/layouts
GET    /api/layouts/:id
POST   /api/layouts
PUT    /api/layouts/:id
DELETE /api/layouts/:id

# Trip Patterns
GET    /api/trip-patterns
GET    /api/trip-patterns/:id
POST   /api/trip-patterns
PUT    /api/trip-patterns/:id
DELETE /api/trip-patterns/:id

# Pattern Stops
GET    /api/trip-patterns/:patternId/stops
POST   /api/pattern-stops
PUT    /api/pattern-stops/:id
DELETE /api/pattern-stops/:id
POST   /api/trip-patterns/:patternId/stops/bulk-replace

# Trip Bases
GET    /api/trip-bases
GET    /api/trip-bases/:id
POST   /api/trip-bases
PUT    /api/trip-bases/:id
DELETE /api/trip-bases/:id

# Price Rules
GET    /api/price-rules
POST   /api/price-rules
PUT    /api/price-rules/:id
DELETE /api/price-rules/:id
```

### Trip Operations

```http
# Trips
GET    /api/trips                    # List trips (optional ?date=YYYY-MM-DD)
GET    /api/trips/:id
POST   /api/trips
PUT    /api/trips/:id
DELETE /api/trips/:id

# CSO Available Trips (union real + virtual)
GET    /api/cso/available-trips?serviceDate=YYYY-MM-DD&outletId=UUID

# Trip Stop Times
GET    /api/trips/:tripId/stop-times
GET    /api/trips/:tripId/stop-times/effective
POST   /api/trips/:tripId/stop-times/bulk-upsert
POST   /api/trips/:tripId/derive-legs
POST   /api/trips/:tripId/precompute-seat-inventory

# Seat Map
GET    /api/trips/:id/seatmap?originSeq=N&destinationSeq=M
GET    /api/trips/:tripId/seats/:seatNo/passenger-details

# Virtual Scheduling
POST   /api/cso/materialize-trip     # Materialisasi trip dari base
POST   /api/trips/:id/close          # Tutup trip operasional
```

### Booking & Payment

```http
# Holds
POST   /api/holds                    # Buat hold kursi
DELETE /api/holds/:holdRef           # Release hold

# Bookings
GET    /api/bookings
GET    /api/bookings/:id
POST   /api/bookings                 # Buat booking (idempotent)

# Payments
GET    /api/bookings/:bookingId/payments
POST   /api/payments

# Pricing
GET    /api/pricing/quote-fare?tripId=X&originSeq=N&destinationSeq=M
```

### Utility

```http
POST   /api/seed                     # Seed demo data
```

---

## 🔄 Alur Booking

### Diagram Alur

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. Outlet   │───>│  2. Trip     │───>│  3. Route    │
│  Selection   │    │  Selection   │    │  Selection   │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  6. Payment  │<───│  5. Passengers│<───│  4. Seats    │
│  & Confirm   │    │  Details     │    │  Selection   │
└──────┬───────┘    └──────────────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│  7. Print    │
│  Ticket      │
└──────────────┘
```

### Detail Alur

1. **Outlet Selection** - Pilih lokasi penjualan
2. **Trip Selection** - Pilih perjalanan dari daftar (real + virtual)
3. **Route Selection** - Pilih asal dan tujuan dari timeline
4. **Seat Selection** - Pilih kursi dari seat map interaktif
5. **Passenger Details** - Isi data penumpang
6. **Payment** - Proses pembayaran
7. **Print** - Cetak tiket

### Seat Hold Mechanism

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ User clicks │────>│ Create Hold │────>│ Short TTL   │
│   seat      │     │  (atomic)   │     │   (60s)     │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           │    ┌──────────────┘
                           ▼    ▼
                    ┌─────────────┐
                    │ User fills  │
                    │passenger form│
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Convert to  │
                    │  Long TTL   │
                    │  (1200s)    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Payment   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Booking    │
                    │  Created    │
                    └─────────────┘
```

---

## 📅 Virtual Scheduling

TransityCore mendukung **Virtual Scheduling** - sistem penjadwalan yang memungkinkan pembuatan trip on-demand dari template (Trip Bases).

### Konsep

```
┌─────────────────────────────────────────────────────────────┐
│                       TRIP BASE                              │
│  (Template dengan jadwal berulang)                          │
│                                                              │
│  • Pattern: Jakarta → Purwakarta → Bandung                 │
│  • Days: Senin - Sabtu                                      │
│  • Time: 10:00 (departure dari Jakarta)                     │
│  • Valid: 2025-01-01 to 2025-12-31                         │
│  • Default Capacity: 40                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Ketika CSO memilih tanggal
                       │ yang eligible
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    VIRTUAL TRIP                              │
│  (Computed on-the-fly, belum ada di database)               │
│                                                              │
│  • Status: isVirtual = true                                 │
│  • Trip ID: null (belum materialized)                       │
│  • Departure: 10:00 (computed dari defaultStopTimes)        │
│  • Capacity: 40 (dari base)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Ketika CSO memilih dan
                       │ memulai booking
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    REAL TRIP                                 │
│  (Materialized ke database)                                 │
│                                                              │
│  • Status: scheduled                                        │
│  • Trip ID: UUID                                            │
│  • Stop Times: Dibuat dari defaultStopTimes                 │
│  • Legs: Derived dari stop times                            │
│  • Seat Inventory: Precomputed                              │
└─────────────────────────────────────────────────────────────┘
```

### Trip Base Schema

```typescript
{
  id: string;
  patternId: string;           // Reference ke trip pattern
  code: string;                // Kode unik (e.g., "JKT-BDG-10AM")
  name: string;                // Nama template
  active: boolean;             // Status aktif
  timezone: string;            // Timezone (default: Asia/Jakarta)
  
  // Hari operasional
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
  
  // Periode berlaku
  validFrom: date;
  validTo: date;
  
  // Default values
  defaultLayoutId: string;
  defaultVehicleId: string;
  capacity: number;
  
  // Channel visibility
  channelFlags: {
    CSO: boolean;
    WEB: boolean;
    APP: boolean;
    OTA: boolean;
  };
  
  // Jadwal waktu per stop
  defaultStopTimes: [
    { stopSequence: 1, arriveAt: null, departAt: "10:00" },
    { stopSequence: 2, arriveAt: "11:30", departAt: "11:45" },
    { stopSequence: 3, arriveAt: "13:00", departAt: null }
  ];
}
```

---

## 🌐 Real-time Events

TransityCore menggunakan Socket.IO untuk komunikasi real-time.

### Event Types

```typescript
interface WSEvents {
  TRIP_STATUS_CHANGED: { tripId: string; status: string };
  TRIP_CANCELED: { tripId: string };
  HOLDS_RELEASED: { tripId: string; seatNos?: string[] };
  TRIP_MATERIALIZED: { baseId: string; serviceDate: string; tripId: string };
  INVENTORY_UPDATED: { tripId: string; seatNo: string; legIndexes?: number[] };
}
```

### Room Subscriptions

```javascript
// Client-side subscription
socket.emit('subscribe-trip', tripId);
socket.emit('subscribe-base', baseId);
socket.emit('subscribe-cso', outletId, serviceDate);

// Unsubscribe
socket.emit('unsubscribe-trip', tripId);
socket.emit('unsubscribe-base', baseId);
socket.emit('unsubscribe-cso', outletId, serviceDate);
```

### Event Flow

```
┌─────────────────┐                    ┌─────────────────┐
│   CSO Client A  │                    │   CSO Client B  │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ subscribe-trip:123                   │ subscribe-trip:123
         │─────────────────────┐                │
         │                     │                │
         │                     ▼                │
         │            ┌─────────────────┐       │
         │            │  WebSocket      │       │
         │            │  Server         │       │
         │            └────────┬────────┘       │
         │                     │                │
         │                     │                │
         │    ┌────────────────┼────────────────┘
         │    │                │
         │    │  INVENTORY_UPDATED
         │    │  { tripId: "123", seatNo: "A1" }
         │    │                │
         ▼    ▼                ▼    ▼
┌─────────────────┐            ┌─────────────────┐
│  Seat A1 marked │            │  Seat A1 marked │
│  as held        │            │  as held        │
└─────────────────┘            └─────────────────┘
```

---

## 📁 Struktur Project

```
TransityCore/
├── attached_assets/          # Asset demo dan prompt
├── client/                   # Frontend React
│   ├── index.html
│   └── src/
│       ├── App.tsx           # Root component
│       ├── components/
│       │   ├── cso/          # Komponen CSO booking
│       │   │   ├── BookingStepper.tsx
│       │   │   ├── PassengerDetailModal.tsx
│       │   │   ├── PassengerForm.tsx
│       │   │   ├── PaymentPanel.tsx
│       │   │   ├── PrintPreview.tsx
│       │   │   ├── RouteTimeline.tsx
│       │   │   ├── SeatMap.tsx
│       │   │   └── TripSelector.tsx
│       │   ├── layout/       # Layout components
│       │   │   ├── AppLayout.tsx
│       │   │   └── Sidebar.tsx
│       │   ├── masters/      # Master data management
│       │   │   ├── LayoutsManager.tsx
│       │   │   ├── OutletsManager.tsx
│       │   │   ├── PriceRulesManager.tsx
│       │   │   ├── StopsManager.tsx
│       │   │   ├── TripBasesManager.tsx
│       │   │   ├── TripPatternsManager.tsx
│       │   │   ├── TripsManager.tsx
│       │   │   └── VehiclesManager.tsx
│       │   └── ui/           # shadcn/ui components
│       ├── hooks/
│       │   ├── useBookingFlow.ts
│       │   ├── useSeatHold.ts
│       │   └── useWebSocket.ts
│       ├── lib/
│       │   ├── api.ts
│       │   ├── queryClient.ts
│       │   └── utils.ts
│       ├── pages/
│       │   ├── cso/CsoPage.tsx
│       │   └── masters/MastersPage.tsx
│       └── types/
│           └── index.ts
├── server/                   # Backend Express
│   ├── config.ts             # App configuration
│   ├── db.ts                 # Database connection
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # API routes registration
│   ├── scheduler.ts          # Background jobs
│   ├── seed.ts               # Demo data seeder
│   ├── storage.ts            # DatabaseStorage implementation
│   ├── modules/              # Feature modules
│   │   ├── bookings/
│   │   │   ├── bookings.controller.ts
│   │   │   ├── bookings.service.ts
│   │   │   └── deterministicBooking.service.ts
│   │   ├── holds/
│   │   │   └── holds.service.ts
│   │   ├── layouts/
│   │   │   ├── layouts.controller.ts
│   │   │   └── layouts.service.ts
│   │   ├── outlets/
│   │   │   ├── outlets.controller.ts
│   │   │   └── outlets.service.ts
│   │   ├── patternStops/
│   │   ├── payments/
│   │   ├── priceRules/
│   │   ├── pricing/
│   │   │   ├── pricing.controller.ts
│   │   │   └── pricing.service.ts
│   │   ├── printing/
│   │   │   └── print.service.ts
│   │   ├── seatInventory/
│   │   │   └── seatInventory.service.ts
│   │   ├── stops/
│   │   ├── tripBases/
│   │   │   └── tripBases.service.ts
│   │   ├── tripLegs/
│   │   ├── tripPatterns/
│   │   ├── tripStopTimes/
│   │   ├── trips/
│   │   └── vehicles/
│   ├── realtime/
│   │   └── ws.ts             # WebSocket service
│   ├── utils/
│   │   └── timezone.ts       # Timezone utilities
│   └── vite.ts               # Vite dev server setup
├── shared/
│   └── schema.ts             # Drizzle schema (shared)
├── components.json           # shadcn/ui config
├── drizzle.config.ts         # Drizzle Kit config
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 🔧 Pengembangan

### Scripts

```bash
# Development
npm run dev              # Start dev server dengan hot reload

# Production
npm run build            # Build client + server
npm run start            # Run production server

# Database
npm run db:push          # Push schema changes ke database

# Type Checking
npm run check            # Run TypeScript compiler
```

### Menambah Module Baru

1. Buat folder di `server/modules/<nama>/`
2. Buat file:
   - `<nama>.service.ts` - Business logic
   - `<nama>.controller.ts` - HTTP handlers
3. Daftarkan routes di `server/routes.ts`
4. Tambahkan schema di `shared/schema.ts` jika perlu tabel baru

### Testing API

```bash
# Seed demo data
curl -X POST http://localhost:5000/api/seed

# Get stops
curl http://localhost:5000/api/stops

# Get available trips for CSO
curl "http://localhost:5000/api/cso/available-trips?serviceDate=2025-02-21&outletId=<UUID>"

# Create hold
curl -X POST http://localhost:5000/api/holds \
  -H "Content-Type: application/json" \
  -d '{"tripId":"<UUID>","seatNo":"A1","originSeq":1,"destinationSeq":3}'

# Create booking
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: booking-123" \
  -d '{...}'
```

---

## 📋 Status Fitur

### ✅ Completed (MVP)

- [x] Database Schema (15 tables)
- [x] Modular Backend Architecture
- [x] PostgreSQL + Drizzle ORM Integration
- [x] Master Data CRUD (Stops, Outlets, Vehicles, Layouts, Patterns, Price Rules)
- [x] Trip Bases CRUD
- [x] Virtual Scheduling System
- [x] Trip Materialization (on-demand)
- [x] Trip Legs Derivation
- [x] Seat Inventory Precomputation
- [x] Seat Hold System (TTL-based)
- [x] Pricing Engine
- [x] CSO Booking Interface (6-step workflow)
- [x] WebSocket Server
- [x] Real-time Event Types
- [x] Print Job Generation
- [x] Idempotent Booking Creation

### 🔄 In Progress

- [ ] Real-time Event Integration di Services
- [ ] Virtual/Closed Badges di CSO UI
- [ ] Complete Seed Data dengan Pickup-Only Configuration

### 📅 Planned

- [ ] Authentication/Authorization
- [ ] Real Payment Provider Integration
- [ ] Thermal Printer Integration
- [ ] Reporting & Analytics Dashboard
- [ ] Redis untuk Distributed Holds
- [ ] Audit Logging
- [ ] Performance Optimization
- [ ] Mobile App API Support
- [ ] OTA Integration
- [ ] Multi-tenancy Support

---

## 🤝 Kontribusi

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/amazing-feature`)
3. Commit perubahan (`git commit -m 'Add amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buka Pull Request

---

## 📄 Lisensi

MIT License - Lihat file [LICENSE](LICENSE) untuk detail.

---

## 📞 Kontak

- **Author**: Rndynt
- **Repository**: [https://github.com/Rndynt/TransityCore](https://github.com/Rndynt/TransityCore)
- **Issues**: [GitHub Issues](https://github.com/Rndynt/TransityCore/issues)

---

## 🙏 Acknowledgments

- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM yang excellent
- [shadcn/ui](https://ui.shadcn.com/) - Komponen UI yang beautiful
- [TanStack Query](https://tanstack.com/query) - Data fetching yang powerful
- [Socket.IO](https://socket.io/) - Real-time communication
