# TransityCore

**Sistem Ticketing Bus Transit Multi-Operator**

TransityCore adalah sistem ticketing bus transit multi-operator yang komprehensif, mendukung pengelolaan rute, perjalanan, kursi, pemesanan, kargo, SPJ, dan harga dinamis. Sistem ini dirancang untuk operasional real-time dengan dukungan WebSocket untuk update inventaris kursi secara live.

---

## Dokumentasi Lengkap

Dokumentasi teknis lengkap dengan penjelasan cara kerja, teknologi, dan logika perhitungan setiap fitur tersedia di:

**[docs/FEATURES.md](docs/FEATURES.md)** — Dokumentasi Fitur Lengkap

| Bab | Topik |
|-----|-------|
| [1. Arsitektur & Teknologi](docs/FEATURES.md#1-arsitektur--teknologi) | Stack teknologi, pola arsitektur, file utama |
| [2. Terminal CSO](docs/FEATURES.md#2-terminal-cso-reservasi) | Alur reservasi, komponen UI, deep-link |
| [3. Manajemen Kursi & Seat Hold](docs/FEATURES.md#3-manajemen-kursi--seat-hold) | Seat map, hold TTL, precompute inventory, leg index |
| [4. Penjadwalan & Virtual Trip](docs/FEATURES.md#4-penjadwalan--virtual-trip) | Trip Base, materialisasi, virtual vs real trip |
| [5. Perhitungan Harga](docs/FEATURES.md#5-perhitungan-harga--pricing-engine) | Price rules, mode per_leg/flat, contoh perhitungan |
| [6. Promo & Voucher](docs/FEATURES.md#6-promo--voucher) | Jenis promo, validasi, voucher redemption |
| [7. Alur Booking](docs/FEATURES.md#7-alur-booking-pemesanan) | Flow lengkap, DB transaction, pending auto-cleanup |
| [8. Kargo](docs/FEATURES.md#8-kargo--pengiriman-barang) | Tarif kargo, waybill, status lifecycle |
| [9. SPJ](docs/FEATURES.md#9-spj-surat-perintah-jalan) | Surat Perintah Jalan, cost lines, settlement |
| [10. Manifest](docs/FEATURES.md#10-manifest-perjalanan) | Manifest trip, cetak thermal 80mm |
| [11. RBAC](docs/FEATURES.md#11-rbac-kontrol-akses-berbasis-peran) | Roles, feature flags, outlet scoping |
| [12. WebSocket](docs/FEATURES.md#12-real-time-websocket) | Rooms, events, fallback polling |
| [13. Laporan](docs/FEATURES.md#13-laporan--analitik) | 7 jenis report, cara perhitungan |
| [14. Unseat & Reschedule](docs/FEATURES.md#14-unseat-reschedule--riwayat-booking) | Unseat, assign, reschedule, cancel, audit trail |
| [15. Aplikasi Mobile](docs/FEATURES.md#15-aplikasi-mobile-b2c) | Expo React Native B2C |
| [16. Optimasi Performa](docs/FEATURES.md#16-optimasi-performa) | Index, N+1 fix, paralelisasi, caching |
| [17. Database & Skema](docs/FEATURES.md#17-database--skema) | Semua tabel dengan keterangan |

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Tech Stack](#tech-stack)
- [Struktur Database](#struktur-database)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [API Endpoints](#api-endpoints)
- [Alur Booking](#alur-booking)
- [Virtual Scheduling](#virtual-scheduling)
- [Otorisasi (RBAC + ABAC + Feature Flags)](#otorisasi-rbac--abac--feature-flags)
- [Real-time Events](#real-time-events)
- [Struktur Project](#struktur-project)
- [Status Fitur](#status-fitur)

---

## Fitur Utama

### Operasional
- **Terminal Reservasi CSO** — 2-phase booking (select trip → book seat), seat map real-time, passenger form, inline payment
- **Jadwal Harian** — Unified daily schedule dengan driver assignment, manifest access, SPJ creation
- **Kargo** — Waybill generation (TRN-YYYYMMDD-XXXXX), tariff calculation, status lifecycle tracking
- **SPJ (Surat Perintah Jalan)** — Trip work orders dengan cost lines, settlement, profit calculation
- **Manifest Perjalanan** — Trip manifest dengan dukungan thermal printer 80mm

### Master Data
- **Halte (Stops)** — Titik berhenti/terminal dengan koordinat GPS
- **Pola Perjalanan (Trip Patterns)** — Template rute dengan urutan pemberhentian, boarding/alighting flags
- **Kendaraan (Vehicles)** — Armada bus dengan kapasitas dan layout kursi
- **Pengemudi (Drivers)** — Data pengemudi dengan lisensi
- **Outlet** — Lokasi penjualan tiket terhubung ke stop
- **Layout Kursi** — Konfigurasi visual layout kursi bus (grid-based)
- **Aturan Harga (Price Rules)** — Harga dinamis scope-based (pattern/trip/leg/time) dengan mode per-leg dan flat
- **Promo & Voucher** — Kode diskon, voucher generation, usage limits

### Booking & Seat Management
- **Virtual → Real Trip** — Trip bases auto-materialize saat booking pertama
- **Seat Inventory** — Pre-computed per seat per leg, real-time hold system dengan TTL
- **Unseat / Reassign / Reschedule** — Full seat management dengan mandatory reason notes dan audit trail
- **WebSocket Broadcast** — Update ketersediaan kursi real-time ke semua terminal CSO

### Laporan (Reports)
- Revenue, Sales, Trip Profitability, Load Factor, Cancellations, Cargo, Payments
- Filter tanggal dengan presets, selector outlet/channel/route

### Admin
- **Staff Management** — CRUD dengan role assignment dan outlet scoping
- **Feature Flags** — Toggle akses fitur per flag key
- **RBAC Roles** — `owner`, `manager`, `finance`, `spv_operations`, `operations`, `spv_cso`, `cso`
- **Outlet Scoping** — Batasi akses data ke outlet yang di-assign

### Mobile (B2C)
- Expo React Native app di `/apps/mobile`
- Sistem auth terpisah (`/api/app/auth/*`)
- Pencarian trip, booking, tracking kargo

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Vite)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   CSO    │  │ Masters  │  │  Admin   │  │ Reports  │      │
│  │   Page   │  │   Page   │  │   Page   │  │   Pages  │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       └──────────────┴──────────────┴──────────────┘            │
│                          │                                      │
│                   React Query + Wouter                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Fastify 5 + TypeScript)               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Auth & RBAC Layer                        │ │
│  │  Realmio Auth │ RBAC Middleware │ Feature Flags │ Outlet   │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                    Routes Layer (104+ endpoints)            │ │
│  │  preHandler arrays │ async handlers │ Zod validation       │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                  Controllers Layer                         │ │
│  │  Bookings │ Pricing │ Cargo │ SPJ │ Reports │ Admin ...   │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                   Services Layer                           │ │
│  │  BookingsService │ PricingService │ RbacService │ ...      │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                  Storage Layer (IStorage)                   │ │
│  │              DatabaseStorage (Drizzle ORM)                  │ │
│  └───────────────────────┬────────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼────────────────────────────────────┐ │
│  │                 WebSocket Service                          │ │
│  │        Socket.IO (Real-time Event Broadcasting)            │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
│  stops │ outlets │ vehicles │ layouts │ trip_patterns │         │
│  pattern_stops │ trip_bases │ trips │ trip_stop_times │        │
│  trip_legs │ seat_inventory │ seat_holds │ price_rules │       │
│  bookings │ passengers │ payments │ print_jobs │               │
│  staff │ feature_flags │ booking_history │ drivers │           │
│  spj │ spj_cost_lines │ promotions │ vouchers │               │
│  cargo_types │ cargo_rates │ cargo_shipments                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify 5 (async-first, preHandler hooks)
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon Serverless compatible)
- **Real-time**: Socket.IO
- **Validation**: Zod + drizzle-zod
- **Auth**: Realmio (whitelabel OpenID Connect)
- **Authorization**: RBAC + ABAC + Feature Flags

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **UI Components**: Radix UI + shadcn/ui
- **Icons**: Lucide React

### Mobile
- **Framework**: Expo React Native
- **Location**: `/apps/mobile`

### Development
- **Package Manager**: npm
- **Type Checking**: TypeScript 5.6
- **Dev Server**: Vite + @fastify/middie (HMR)
- **Bundler**: esbuild (production), Vite (development)

---

## Struktur Database

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
             ┌──────▼──────┐       │     ┌─────────────┐
             │    trips    │<──────┘     │   drivers   │
             └──────┬──────┘             └──────┬──────┘
                    │                           │
        ┌───────────┼───────────┐               │
        │           │           │               │
┌───────▼───────┐   │   ┌───────▼───────┐       │
│trip_stop_times│   │   │   trip_legs   │       │
└───────────────┘   │   └───────┬───────┘       │
                    │           │               │
             ┌──────▼──────┐    │        ┌──────▼──────┐
             │seat_inventory│<──┘        │     spj     │
             └──────┬──────┘             └──────┬──────┘
                    │                           │
             ┌──────▼──────┐             ┌──────▼──────┐
             │  seat_holds │             │spj_cost_lines│
             └─────────────┘             └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  bookings   │────<│ passengers  │     │  payments   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ├──────────<┌─────────────┐
       │           │booking_history│
       │           └─────────────┘
       │
┌──────▼──────┐     ┌─────────────┐     ┌─────────────┐
│ print_jobs  │     │ promotions  │────<│  vouchers   │
└─────────────┘     └─────────────┘     └─────────────┘

┌─────────────┐     ┌───────────────┐
│    staff    │     │ feature_flags │
└─────────────┘     └───────────────┘

┌─────────────┐     ┌─────────────┐     ┌───────────────┐
│ cargo_types │────<│ cargo_rates │     │cargo_shipments│
└─────────────┘     └─────────────┘     └───────────────┘
```

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `stops` | Titik berhenti/terminal bus |
| `outlets` | Lokasi penjualan tiket |
| `layouts` | Konfigurasi layout kursi |
| `vehicles` | Armada bus |
| `drivers` | Data pengemudi |
| `trip_patterns` | Pola rute (template) |
| `pattern_stops` | Urutan stop dalam pola |
| `trip_bases` | Template penjadwalan virtual |
| `trips` | Instance perjalanan aktual |
| `trip_stop_times` | Jadwal kedatangan/keberangkatan per stop |
| `trip_legs` | Segmen perjalanan antar stop |
| `seat_inventory` | Ketersediaan kursi per segmen |
| `seat_holds` | Reservasi kursi sementara (TTL-based) |
| `price_rules` | Aturan harga dinamis |
| `bookings` | Data pemesanan |
| `passengers` | Data penumpang |
| `payments` | Data pembayaran |
| `booking_history` | Audit trail (unseat/reassign/reschedule/cancel) |
| `print_jobs` | Antrian cetak tiket |
| `staff` | Staff users dengan role & outlet scope |
| `feature_flags` | Feature flag toggles |
| `spj` | Surat Perintah Jalan |
| `spj_cost_lines` | Detail biaya SPJ |
| `promotions` | Promo/diskon |
| `vouchers` | Voucher individual |
| `cargo_types` | Jenis kargo |
| `cargo_rates` | Tarif kargo |
| `cargo_shipments` | Data pengiriman kargo |

---

## Instalasi

### Prasyarat
- Node.js 20+
- PostgreSQL 14+ (atau Neon Serverless)

### Langkah Instalasi

```bash
# Clone repository
git clone https://github.com/Rndynt/TransityTerminal.git
cd TransityTerminal

# Install dependencies
npm install

# Setup environment variables (lihat bagian Konfigurasi)

# Push schema ke database
npm run db:push

# Jalankan development server
npm run dev
```

Aplikasi berjalan di `http://localhost:5000`.

### Build & Production

```bash
# Build untuk production
npm run build

# Jalankan production server
npm start
```

---

## Konfigurasi

### Environment Variables

| Variable | Default | Deskripsi | Required |
|----------|---------|-----------|----------|
| `DATABASE_URL` | — | PostgreSQL connection string | Ya |
| `PORT` | 5000 | Port server | Tidak |
| `AUTHCORE_BASE_URL` | — | URL Realmio auth server | Tidak (dev bypass tersedia) |
| `AUTHCORE_TENANT_ID` | — | Realmio tenant ID | Tidak |
| `DEV_BYPASS_AUTH` | — | Set `true` untuk skip auth di development | Tidak |
| `HOLD_TTL_SHORT_SECONDS` | 300 | TTL hold singkat (5 menit) | Tidak |
| `HOLD_TTL_LONG_SECONDS` | 1800 | TTL hold panjang (30 menit) | Tidak |
| `PENDING_BOOKING_AUTO_RELEASE` | true | Auto-cleanup booking pending | Tidak |

### Dev Mode

Jika `AUTHCORE_BASE_URL` kosong atau `DEV_BYPASS_AUTH=true`, sistem akan auto-login dengan dev user:
- **Email**: cso@transity.id
- **Role**: cso
- **Flags**: page.cso, page.cargo, page.manifest, action.booking.create, action.booking.cancel, action.passenger.assign_seat, action.payment.create, action.cargo.create

---

## API Endpoints

### Authentication

```http
POST   /api/auth/sign-in/email    # Sign in dengan email/password
POST   /api/auth/sign-up/email    # Registrasi akun baru
POST   /api/auth/sign-out         # Sign out
GET    /api/auth/session           # Session saat ini
GET    /api/auth/me                # Data user saat ini
```

### Permissions & Admin

```http
GET    /api/permissions/me         # Flags & role user saat ini

GET    /api/admin/staff            # List semua staff
POST   /api/admin/staff            # Buat staff baru
PUT    /api/admin/staff/:id        # Update staff
DELETE /api/admin/staff/:id        # Hapus staff

GET    /api/admin/flags            # List feature flags
POST   /api/admin/flags            # Buat feature flag
PUT    /api/admin/flags/:id        # Update feature flag
DELETE /api/admin/flags/:id        # Hapus feature flag
```

### Master Data

```http
# Stops
GET/POST       /api/stops
GET/PUT/DELETE /api/stops/:id

# Outlets
GET/POST       /api/outlets
GET/PUT/DELETE /api/outlets/:id

# Vehicles
GET/POST       /api/vehicles
GET/PUT/DELETE /api/vehicles/:id

# Drivers
GET/POST       /api/drivers
GET/PUT/DELETE /api/drivers/:id

# Layouts
GET/POST       /api/layouts
GET/PUT/DELETE /api/layouts/:id

# Trip Patterns
GET/POST       /api/trip-patterns
GET/PUT/DELETE /api/trip-patterns/:id

# Pattern Stops
GET    /api/trip-patterns/:patternId/stops
POST   /api/pattern-stops
PUT    /api/pattern-stops/:id
DELETE /api/pattern-stops/:id
POST   /api/trip-patterns/:patternId/stops/bulk-replace

# Trip Bases
GET/POST       /api/trip-bases
GET/PUT/DELETE /api/trip-bases/:id

# Price Rules
GET/POST       /api/price-rules
PUT/DELETE     /api/price-rules/:id

# Promos & Vouchers
GET/POST       /api/promos
PUT/DELETE     /api/promos/:id
POST           /api/promos/:id/vouchers          # Generate vouchers
DELETE         /api/promos/:id/vouchers/:voucherId # Revoke voucher
```

### Trip Operations

```http
# Trips
GET    /api/trips                             # List trips (?date=YYYY-MM-DD)
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
GET    /api/trips/:id/unseated-passengers

# Virtual Scheduling
POST   /api/cso/materialize-trip
POST   /api/trips/:id/close

# Manifest
GET    /api/trips/:id/manifest
POST   /api/trips/:id/manifest/print
```

### Booking & Payment

```http
# Holds
POST   /api/holds                              # Buat hold kursi
DELETE /api/holds/:holdRef                      # Release hold

# Bookings
GET    /api/bookings
GET    /api/bookings/:id
POST   /api/bookings
GET    /api/bookings/:bookingId/history         # Audit trail

# Unseat / Reassign / Reschedule
POST   /api/passengers/:passengerId/unseat
POST   /api/passengers/:passengerId/reassign
POST   /api/passengers/:passengerId/reschedule
POST   /api/passengers/:passengerId/assign-seat
PATCH  /api/passengers/:id/cancel
POST   /api/bookings/:bookingId/unseat-all

# Payments
GET    /api/bookings/:bookingId/payments
POST   /api/payments

# Pricing
GET    /api/pricing/quote-fare?tripId=X&originSeq=N&destinationSeq=M
```

### SPJ (Surat Perintah Jalan)

```http
GET    /api/spj                                # List SPJ
GET    /api/spj/:id                            # Detail SPJ
POST   /api/spj                                # Buat SPJ
POST   /api/spj/:id/issue                      # Terbitkan SPJ
POST   /api/spj/:id/settle                     # Selesaikan SPJ
GET    /api/spj/trip/:tripId                    # SPJ by trip
GET    /api/spj/trip/:tripId/profit             # Profit calculation
```

### Kargo

```http
GET    /api/cargo                              # List shipments
POST   /api/cargo                              # Buat shipment
GET    /api/cargo/track/:waybillNumber          # Track by waybill
GET    /api/cargo-types                         # List cargo types
GET    /api/cargo-rates                         # List cargo rates
```

### Laporan

```http
GET    /api/reports/filter-options              # Filter options
GET    /api/reports/revenue                     # Laporan pendapatan
GET    /api/reports/sales                       # Laporan penjualan
GET    /api/reports/trip-profitability           # Laporan profitabilitas trip
GET    /api/reports/load-factor                 # Laporan load factor
GET    /api/reports/cancellations               # Laporan pembatalan
GET    /api/reports/cargo                       # Laporan kargo
GET    /api/reports/payments                    # Laporan pembayaran
```

### Mobile B2C API

```http
POST   /api/app/auth/register                  # Registrasi user mobile
POST   /api/app/auth/login                     # Login user mobile
GET    /api/app/trips                           # Cari trip tersedia
POST   /api/app/bookings                       # Buat booking mobile
GET    /api/app/cargo/track/:waybillNumber      # Track kargo
```

---

## Alur Booking

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

1. **Outlet Selection** — Pilih lokasi penjualan
2. **Trip Selection** — Pilih perjalanan dari daftar (real + virtual trips)
3. **Route Selection** — Pilih asal (Naik) dan tujuan (Turun) dari RouteTimeline
4. **Seat Selection** — Pilih kursi dari seat map interaktif (hold otomatis dengan TTL)
5. **Passenger Details** — Isi data penumpang + promo code (opsional)
6. **Payment** — Proses pembayaran (cash, QR, e-wallet, bank transfer)
7. **Print** — Cetak tiket thermal

### Seat Hold Mechanism

```
User klik kursi → Create Hold (Short TTL 300s)
                         │
                         ▼
               User isi form penumpang
                         │
                         ▼
               Convert ke Long TTL (1800s)
                         │
                         ▼
                    Payment
                         │
                         ▼
                 Booking Created → Hold Released
```

- Hold expired otomatis di-cleanup oleh scheduler (setiap 1 menit)
- WebSocket broadcast saat seat di-hold atau di-release

---

## Virtual Scheduling

TransityCore mendukung **Virtual Scheduling** — sistem penjadwalan yang memungkinkan pembuatan trip on-demand dari template (Trip Bases).

### Konsep

```
TRIP BASE (Template)
  • Pattern: Jakarta → Purwakarta → Bandung
  • Hari: Senin - Sabtu
  • Waktu: 10:00 (departure dari Jakarta)
  • Periode: 2025-01-01 s/d 2025-12-31
  • Kapasitas: 40
         │
         │ CSO pilih tanggal eligible
         ▼
VIRTUAL TRIP (Computed on-the-fly)
  • isVirtual = true
  • Belum ada di database
  • Departure: 10:00 (dari defaultStopTimes)
         │
         │ CSO mulai booking
         ▼
REAL TRIP (Materialized ke database)
  • Status: scheduled
  • Trip ID: UUID
  • Stop Times: dari defaultStopTimes
  • Legs: derived dari stop times
  • Seat Inventory: precomputed
```

---

## Otorisasi (RBAC + ABAC + Feature Flags)

### Model

Sistem otorisasi 3 lapis:

1. **RBAC (Role-Based Access Control)** — Role menentukan akses dasar
2. **ABAC (Attribute-Based Access Control)** — Outlet scoping membatasi data per lokasi
3. **Feature Flags** — Toggle granular per fitur

### Roles

| Role | Deskripsi | Akses |
|------|-----------|-------|
| `owner` | Pemilik | Akses penuh ke semua fitur |
| `manager` | Manajer | Operasional penuh + semua laporan |
| `finance` | Keuangan | Laporan keuangan + lihat booking (read-only) |
| `spv_operations` | SPV Operasional | Jadwal, SPJ, manifest, kargo |
| `operations` | Staf Operasional | Operasional harian terbatas |
| `spv_cso` | SPV CSO | CSO + unseat/reschedule |
| `cso` | Customer Service Officer | Booking dan transaksi harian |

### Feature Flags

| Flag | Deskripsi |
|------|-----------|
| `page.cso` | Akses halaman CSO |
| `page.cargo` | Akses halaman Kargo |
| `page.manifest` | Akses halaman Manifest |
| `action.booking.create` | Buat booking baru |
| `action.booking.cancel` | Batalkan booking |
| `action.passenger.assign_seat` | Assign kursi ke penumpang |
| `action.payment.create` | Buat pembayaran |
| `action.cargo.create` | Buat shipment kargo |
| `master.stops` | CRUD master stops |
| `master.vehicles` | CRUD master vehicles |

### Middleware (Fastify preHandler)

```typescript
// Require specific flag
app.post('/api/stops', { preHandler: [requireFlag('master.stops')] }, handler);

// Require any of multiple flags
app.get('/api/trips', { preHandler: [requireAnyFlag('page.cso', 'page.cargo')] }, handler);

// Outlet scoping
app.get('/api/bookings', { preHandler: [requireOutletScope] }, handler);
```

---

## Real-time Events

### WebSocket Rooms

| Room | Pattern | Deskripsi |
|------|---------|-----------|
| Trip | `trip:{tripId}` | Update trip spesifik |
| Base | `base:{baseId}` | Update trip base |
| CSO | `cso:{outletId}:{serviceDate}` | Update per outlet per tanggal |

### Events

| Event | Payload | Deskripsi |
|-------|---------|-----------|
| `INVENTORY_UPDATED` | `{ tripId }` | Perubahan ketersediaan kursi |
| `TRIP_STATUS_CHANGED` | `{ tripId, status }` | Status trip berubah |
| `HOLDS_RELEASED` | `{ tripId }` | Seat hold expired/released |
| `TRIP_MATERIALIZED` | `{ tripId, baseId }` | Virtual trip dimaterialize |
| `TRIP_CANCELED` | `{ tripId }` | Trip dibatalkan |

---

## Struktur Project

```
client/src/
  pages/              Halaman utama
    auth/             Login page
    admin/            Staff & Feature Flag management
    schedule/         Jadwal Harian
    spj/              SPJ page
    reports/          7 report pages
  components/
    cso/              Terminal CSO (TripSelector, SeatMap, PassengerForm, RouteTimeline)
    masters/          Master data managers
    manifest/         ManifestDialog + ThermalManifest
    reports/          Report components (ReportFilters, SummaryCards)
    shared/           Reusable components (StatusBadge, LoadingState, EmptyState)
  hooks/              Custom hooks (useBookingFlow, useWebSocket, useSeatHold)
  lib/
    constants.ts      Centralized constants
    api.ts            API client
    auth.tsx          AuthProvider + useAuth
    queryClient.ts    React Query config

server/
  index.ts            Fastify app bootstrap
  routes.ts           104+ API endpoints (preHandler arrays)
  storage.ts          DatabaseStorage (Drizzle ORM)
  vite.ts             Vite HMR + static serving
  scheduler.ts        Expired holds/bookings cleanup
  types/
    fastify.d.ts      Request type augmentations (user, rbac, appUser, scopedOutletId, rawBody)
  realtime/
    ws.ts             Socket.io WebSocket server
  modules/
    auth/             Realmio auth proxy
    rbac/             RBAC + ABAC + Feature Flags
    app/              Mobile B2C API
    bookings/         BookingsService + UnseatService
    pricing/          PricingService (scope-based pricing)
    cargo/            CargoService
    spj/              SPJ (Surat Perintah Jalan)
    reports/          7 report types
    promos/           Promo & Voucher system
    payments/         Payment processing
    holds/            Seat hold management
    seatInventory/    Seat inventory service
    tripBases/        Virtual → Real trip materialization
    tripLegs/         Trip leg computation
    drivers/          Driver management
    vehicles/         Vehicle management
    stops/            Stop management
    outlets/          Outlet management
    layouts/          Bus seat layouts
    trips/            Trip management
    tripPatterns/     Trip pattern management
    patternStops/     Pattern stop management
    tripStopTimes/    Trip stop time overrides
    priceRules/       Price rule management
    printing/         Thermal print service

shared/
  schema.ts           Drizzle table definitions + Zod schemas + shared types

apps/mobile/          Expo React Native B2C app
plan/                 Technical documentation
```

---

## Status Fitur

| Fitur | Status |
|-------|--------|
| Master Data (Stops, Outlets, Vehicles, Layouts, Patterns) | Done |
| Trip Bases & Virtual Scheduling | Done |
| CSO Booking Terminal (SeatMap, PassengerForm, Payment) | Done |
| Seat Inventory & Hold System | Done |
| Pricing Engine (per-leg, flat, scope-based) | Done |
| Promo & Voucher | Done |
| Kargo Terminal | Done |
| Manifest & Thermal Print | Done |
| SPJ (Surat Perintah Jalan) | Done |
| Jadwal Harian | Done |
| Unseat / Reassign / Reschedule | Done |
| Booking History (Audit Trail) | Done |
| Reports (7 jenis laporan) | Done |
| Authentication (Realmio) | Done |
| RBAC + ABAC + Feature Flags | Done |
| Admin UI (Staff & Flag Management) | Done |
| Mobile B2C (Expo React Native) | In Progress |
| Backend: Fastify 5 Migration | Done |

---

## License

MIT
