# TransityTerminal

**Sistem Ticketing Bus Transit Multi-Operator**

TransityTerminal adalah sistem ticketing bus transit multi-operator yang komprehensif, mendukung pengelolaan rute, perjalanan, kursi, pemesanan, kargo, SPJ, dan harga dinamis. Sistem ini dirancang untuk operasional real-time dengan dukungan WebSocket untuk update inventaris kursi secara live.

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
| [13. Laporan](docs/FEATURES.md#13-laporan--analitik) | 8 jenis report, snapshot-based, cara perhitungan |
| [14. Unseat & Reschedule](docs/FEATURES.md#14-unseat-reschedule--riwayat-booking) | Unseat, assign, reschedule, batch reschedule, cancel, audit trail |
| [15. Aplikasi Mobile](docs/FEATURES.md#15-aplikasi-mobile-b2c) | Expo React Native B2C |
| [16. Optimasi Performa](docs/FEATURES.md#16-optimasi-performa) | Index, N+1 fix, paralelisasi, caching |
| [17. Database & Skema](docs/FEATURES.md#17-database--skema) | Semua tabel dengan keterangan |
| [18. Data Integrity](docs/FEATURES.md#18-data-integrity--snapshot-system) | Snapshot columns, impact check, backfill |
| [19. Security](docs/FEATURES.md#19-security) | Rate limit, validation, webhook, production guards |

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
- **Terminal Reservasi CSO** — Dua mode booking: *Sekali Jalan* (one-way, 7-step flow) dan *Pulang Pergi/PP* (round-trip, satu transaksi dengan dua trip terhubung via `booking_groups`). Seat map real-time, passenger form, inline payment, print ticket.
- **Pulang Pergi (PP)** — Booking dua arah dalam satu transaksi. Flow 4-step (Pergi → Pulang → Penumpang → Selesai). Outbound dan return seat hold harus aktif sebelum submit. Menghasilkan `groupCode` yang menghubungkan kedua booking.
- **Jadwal Harian** — Unified daily schedule dengan driver assignment, manifest access, SPJ creation
- **Kargo** — Waybill generation (TRN-YYYYMMDD-XXXXX), tariff calculation, status lifecycle tracking
- **SPJ (Surat Perintah Jalan)** — Trip work orders dengan cost lines, settlement, profit calculation
- **Manifest Perjalanan** — Trip manifest dengan dukungan thermal printer 80mm
- **Dashboard** — Ringkasan operasional: total trip, booking, revenue, kargo, load factor, alert, dan recent bookings
- **Kasir** — Buka/tutup sesi kasir harian, approval sesi, breakdown settlement, live transaction summary (auto-refresh 30s)
- **Refund** — Buat/approve/proses refund dengan pencarian booking code. CSO buat, manager/finance approve & proses
- **Pelanggan (CRM)** — Profil pelanggan dengan tag (regular/vip/frequent/blacklist) dan riwayat booking

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
- **Batch Reschedule on Close** — Saat close trip, otomatis deteksi penumpang aktif dan batch reschedule ke trip lain
- **WebSocket Broadcast** — Update ketersediaan kursi real-time ke semua terminal CSO

### Laporan (Reports)
- Revenue, Sales, Trip Profitability, Load Factor, Cancellations, Cargo, Payments, Commercial Fee
- Filter tanggal dengan presets, selector outlet/channel/route
- Snapshot-based: laporan historis menggunakan data snapshot saat transaksi, bukan data master terkini

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
│  booking_groups │ staff_members │ feature_flags │ drivers │   │
│  booking_history │ spj │ spj_cost_lines │ promotions │        │
│  vouchers │ cargo_types │ cargo_rates │ cargo_shipments │      │
│  refunds │ cashier_sessions │ customers │ notifications │      │
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
| `booking_groups` | Pengelompokan booking PP (round-trip) — menyimpan `groupCode`, `outboundBookingId`, `returnBookingId` |
| `passengers` | Data penumpang |
| `payments` | Data pembayaran |
| `booking_history` | Audit trail (unseat/reassign/reschedule/cancel) |
| `print_jobs` | Antrian cetak tiket |
| `staff_members` | Staff users dengan role & outlet scope |
| `feature_flags` | Feature flag toggles |
| `spj` | Surat Perintah Jalan |
| `spj_cost_lines` | Detail biaya SPJ |
| `promotions` | Promo/diskon |
| `vouchers` | Voucher individual |
| `cargo_types` | Jenis kargo |
| `cargo_rates` | Tarif kargo |
| `cargo_shipments` | Data pengiriman kargo |
| `refunds` | Permintaan refund (create → approve → process) |
| `cashier_sessions` | Sesi kasir harian (open → closing → closed) |
| `customers` | Profil pelanggan B2C dengan tag CRM |
| `notifications` | Notifikasi in-app per staff member |
| `operator_settings` | Pengaturan branding per operator (nama, logo, warna) |

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
| `REALMIO_BASE_URL` | — | URL Realmio auth server | Tidak (dev bypass tersedia) |
| `REALMIO_TENANT_ID` | — | Realmio tenant ID | Tidak |
| `DEV_BYPASS_AUTH` | — | Hanya aktif jika `NODE_ENV !== 'production'` | Tidak |
| `JWT_SECRET` | — | Secret untuk JWT mobile auth | Ya (production) |
| `PAYMENT_WEBHOOK_SECRET` | — | Secret untuk verifikasi webhook pembayaran | Ya (production) |
| `APP_CORS_ORIGINS` | `*` | Allowed origins untuk mobile API | Tidak |
| `HOLD_TTL_SHORT_SECONDS` | 300 | TTL hold singkat (5 menit) | Tidak |
| `HOLD_TTL_LONG_SECONDS` | 1800 | TTL hold panjang (30 menit) | Tidak |
| `PENDING_BOOKING_AUTO_RELEASE` | true | Auto-cleanup booking pending | Tidak |

### Dev Mode

Jika `NODE_ENV !== 'production'` dan `REALMIO_BASE_URL` kosong, sistem akan auto-login sebagai owner dengan semua permission. `DEV_BYPASS_AUTH` di-hardcode ke `!IS_PRODUCTION` — tidak bisa aktif di production meskipun env var di-set.

### Security Notes

- **Rate Limiting**: Login 10 req/menit, Register 5 req/menit (`@fastify/rate-limit`)
- **Webhook**: HMAC-SHA256 signature verification dengan timing-safe comparison
- **Response Redaction**: Token, password, session data di-redact dari semua log
- **Seed Protection**: `/api/seed` diblokir total di production + memerlukan `admin.flags.manage`
- **CORS**: Mobile API dikonfigurasi via `APP_CORS_ORIGINS`, admin dashboard same-origin

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
POST   /api/trips/:id/close-with-reschedule    # Close + batch reschedule penumpang aktif
GET    /api/trips/:id/active-passengers         # Daftar penumpang aktif di trip

# Impact Check (Data Integrity)
GET    /api/stops/:id/impact                    # Cek trip/booking terdampak jika stop diubah
GET    /api/trip-patterns/:id/impact            # Cek trip terdampak jika pattern diubah

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
POST   /api/bookings                           # Booking sekali jalan
POST   /api/bookings/round-trip                # Booking PP (pulang pergi) — atomik, 2 trip 1 transaksi
GET    /api/bookings/:bookingId/history         # Audit trail
GET    /api/bookings/search?q=CODE              # Pencarian booking code (untuk refund autocomplete)

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

### Dashboard, Kasir, Refund, Pelanggan

```http
# Dashboard
GET    /api/dashboard/summary                  # Ringkasan operasional harian

# Kasir
GET    /api/cashier/sessions                   # List sesi kasir
POST   /api/cashier/open                       # Buka sesi kasir
POST   /api/cashier/close                      # Ajukan penutupan sesi
POST   /api/cashier/approve/:sessionId         # Approve penutupan sesi
GET    /api/cashier/sessions/:id               # Detail sesi + transaksi

# Refund
GET    /api/refunds                            # List refund
POST   /api/refunds                            # Buat permintaan refund
POST   /api/refunds/:id/approve                # Approve refund
POST   /api/refunds/:id/process                # Proses/bayar refund
POST   /api/refunds/:id/reject                 # Tolak refund

# Pelanggan
GET    /api/customers                          # List pelanggan
GET    /api/customers/:id                      # Detail + riwayat booking
PATCH  /api/customers/:id/tag                  # Update tag pelanggan

# Notifikasi
GET    /api/notifications                      # List notifikasi
PATCH  /api/notifications/:id/read             # Tandai dibaca
POST   /api/notifications/read-all             # Tandai semua dibaca

# Operator Settings
GET    /api/settings                           # Baca pengaturan branding
PUT    /api/settings                           # Update pengaturan branding
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
GET    /api/reports/commercial-fee              # Laporan biaya komersial
```

Query parameter `dateMode` (`departure` | `paid` | `created`) menentukan kolom tanggal yang digunakan untuk filter:
- `paid` — filter berdasarkan tanggal pembayaran (`payments.paid_at` / `cargo_shipments.paid_at`)
- `created` — filter berdasarkan tanggal transaksi (`bookings.created_at` / `cargo_shipments.created_at`)
- `departure` — filter berdasarkan tanggal keberangkatan (`trips.service_date`)

Laba Rugi Trip dan Load Factor selalu menggunakan `departure` (tanpa toggle).

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

### Sekali Jalan (One-Way)

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

1. **Outlet Selection** — Pilih lokasi penjualan
2. **Trip Selection** — Pilih perjalanan dari daftar (real + virtual trips)
3. **Route Selection** — Pilih asal (Naik) dan tujuan (Turun) dari RouteTimeline
4. **Seat Selection** — Pilih kursi dari seat map interaktif (hold otomatis dengan TTL)
5. **Passenger Details** — Isi data penumpang + promo code (opsional)
6. **Payment** — Proses pembayaran (cash, QR, e-wallet, bank transfer)
7. **Print** — Cetak tiket thermal

### Pulang Pergi / PP (Round-Trip)

```
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  STEP 1: Pergi               │    │  STEP 2: Pulang              │
│  Pilih trip + rute + kursi   │───>│  Pilih trip + rute + kursi   │
│  (Outbound seat hold aktif)  │    │  (Return seat hold aktif)    │
└──────────────────────────────┘    └──────────────┬───────────────┘
                                                   │
                    ┌──────────────────────────────┘
                    ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  STEP 3: Penumpang + Payment │───>│  STEP 4: Selesai             │
│  Isi nama per kursi, bayar   │    │  Print 2 tiket + groupCode   │
└──────────────────────────────┘    └──────────────────────────────┘
```

- Kedua booking dibuat atomik dalam satu DB transaction via `POST /api/bookings/round-trip`
- Hasil: `groupCode` (penghubung), `outboundBookingCode`, `returnBookingCode`
- Jumlah penumpang outbound dan return harus sama
- Boarding/alighting rules divalidasi untuk kedua trip

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
| `action.trip.batch_reschedule` | Batch reschedule saat close trip |
| `page.schedule.closed` | Lihat closed trips di halaman jadwal |
| `page.cso.view_closed` | Lihat closed trips di halaman CSO |
| `report.commercial_fee` | Akses laporan biaya komersial |
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
shared/
  schema/                    Drizzle table definitions, dipecah per domain
    index.ts                 Re-exports semua domain schemas
    enums.ts                 Semua pgEnum definitions
    fleet.ts                 drivers, vehicles, layouts
    network.ts               stops, outlets
    scheduling.ts            tripPatterns, patternStops, tripBases, trips, tripStopTimes, tripLegs
    inventory.ts             seatInventory, seatHolds, priceRules
    booking.ts               bookings, passengers, payments, printJobs
    cargo.ts                 cargoShipments, cargoTypes, cargoRates
    finance.ts               tripCostTemplates, tripCostItems
    promo.ts                 promotions, vouchers
    spj.ts                   SPJ tables
    rbac.ts                  roles, featureFlags, roleFlags, staffMembers
    app-users.ts             appUsers (mobile B2C)
    relations.ts             Drizzle relations definitions

server/
  index.ts                   Fastify app bootstrap (decorateRequest, logging, error handler)
  routes.ts                  Route orchestrator — delegates ke registerXxxRoutes() per module
  storage.interface.ts       IStorage interface + manifest types
  storage.ts                 Thin facade — delegasi ke 6 domain repositories
  db.ts                      Drizzle ORM instance + PostgreSQL pool
  vite.ts                    Vite HMR (@fastify/middie) + static serving (@fastify/static)
  scheduler.ts               Expired holds/bookings cleanup (1 menit interval)
  types/
    fastify.d.ts             Request type augmentations (user, rbac, appUser, scopedOutletId, rawBody)
  realtime/
    ws.ts                    Socket.io WebSocket server
  repositories/              Domain-specific data access (SQL queries via Drizzle)
    fleet.repository.ts      drivers, vehicles, layouts
    network.repository.ts    stops, outlets
    scheduling.repository.ts trips, patterns, bases, stopTimes, legs, inventory, priceRules, manifest
    booking.repository.ts    bookings, passengers, payments, printJobs
    cargo.repository.ts      cargoTypes, cargoRates, cargoShipments
    finance.repository.ts    costTemplates, costItems, promotions, vouchers
  modules/                   Business logic + API controllers (1 folder per domain)
    auth/                    Realmio auth proxy (realmio.ts middleware, auth.routes.ts)
    rbac/                    RBAC + Feature Flags (rbac.middleware.ts, rbac.service.ts, rbac.admin.routes.ts)
    app/                     Mobile B2C API auth + controllers
    bookings/                BookingsService + BookingsController + UnseatService
                             roundTrip.controller.ts + roundTrip.service.ts (PP booking)
    pricing/                 PricingService + PricingController
    cargo/                   CargoService + CargoController
    seatInventory/           SeatInventoryService
    tripBases/               TripBasesService (materialisasi virtual → real)
    tripLegs/                TripLegsService
    spj/                     SpjService + SpjController (Surat Perintah Jalan)
    reports/                 ReportsService + ReportsController (8 report types) + ReportsRepository
    promos/                  PromosService + PromosController (promo & voucher)
    payments/                PaymentsController
    holds/                   HoldsService (seat hold management)
    drivers/                 DriversController + DriversService + performance endpoint
    vehicles/                VehiclesController + VehiclesService
    stops/                   StopsController + StopsService
    outlets/                 OutletsController
    layouts/                 LayoutsController
    trips/                   TripsController
    tripPatterns/            TripPatternsController
    patternStops/            PatternStopsController
    tripStopTimes/           TripStopTimesController
    priceRules/              PriceRulesController
    printing/                PrintService (single & round-trip ticket payload generator)
    dashboard/               DashboardController (ringkasan operasional harian)
    cashier/                 CashierController + CashierService (sesi kasir, open/close/approve)
    refunds/                 RefundsController + RefundsService (create/approve/process/reject)
    customers/               CustomersController + CustomersService (CRM, tag pelanggan)
    notifications/           NotificationsController (bell icon, mark read, delete)
    maintenance/             MaintenanceController (rekam servis kendaraan, alert)
    scheduler/               Background cleanup (expired holds + pending bookings, 1 menit interval)
    settings/                OperatorSettingsController (branding: nama, logo, warna)

client/src/
  App.tsx                    Root router (wouter) + React.lazy page imports
  pages/
    cso/                     CsoPage — terminal reservasi CSO (mode: sekali jalan + PP/round-trip)
    cargo/                   CargoListPage + CargoTerminalPage
    bookings/                AllBookingsPage — daftar semua booking
    schedule/                SchedulePage — jadwal harian + assign driver + buat SPJ
    scheduler/               SchedulerPage — manajemen jadwal template
    manifest/                ManifestPage
    spj/                     SpjPage — manajemen Surat Perintah Jalan
    masters/                 MastersPage — CRUD master data
    reports/                 8 report pages (Revenue, Sales, Profitability, Commercial Fee, dll)
    admin/                   AdminStaffPage + AdminFlagsPage + SettingsPage (branding)
    auth/                    LoginPage + SetupPage (onboarding owner pertama)
    dashboard/               DashboardPage
    cashier/                 CashierPage — sesi kasir harian
    refunds/                 RefundsPage — manajemen refund
    customers/               CustomersPage — CRM pelanggan
  components/
    cso/                     Komponen terminal CSO
      TripSelector.tsx       Pilih outlet + tanggal + trip
      RouteTimeline.tsx      Timeline halte naik/turun
      SeatMap.tsx            Peta kursi interaktif + real-time
      PassengerForm.tsx      Form penumpang + pembayaran
      PassengerDetailModal   Detail penumpang + unseat/reschedule/cancel
      BatchRescheduleDialog  Dialog batch reschedule saat close trip
      BookingStepper.tsx     Step indicator booking
      CargoForm.tsx          Form kargo di CSO
    masters/                 Komponen CRUD master data
      StopsManager           CRUD halte
      TripPatternsManager    CRUD pola trip
      TripBasesManager       CRUD jadwal template (→ TripBaseFormDialog + TripBaseGroupList)
      TripsManager           Manage trip instances (→ TripsFilterPanel)
      DriversManager         CRUD driver
      VehiclesManager        CRUD kendaraan
      LayoutsManager         CRUD layout kursi
      OutletsManager         CRUD outlet
      PriceRulesManager      CRUD aturan harga
      CargoTypesManager      CRUD tipe kargo
      CargoRatesManager      CRUD tarif kargo
      PromosManager          CRUD promo & voucher
    manifest/                ManifestDialog + ThermalManifest (cetak 80mm)
    reports/                 ReportFilters, SummaryCards, ReportPageLayout
    shared/                  Reusable: DataTable, StatusBadges
    layout/                  Sidebar, ProtectedRoute
    rbac/                    RequireFlag + CanAccess permission components
    ui/                      shadcn/ui components
  hooks/
    useBookingFlow.ts        State machine booking flow CSO (one-way, 7 step)
    useRoundTripFlow.ts      State machine PP (round-trip, 4 step) — orchestrasi dua seat hold + submit atomik
    useSeatHold.ts           Seat hold timer + auto-release
    useWebSocket.ts          Socket.io connection management
    use-toast.ts             Toast notifications
  lib/
    api.ts                   API client functions (grouped per domain)
    auth.tsx                 AuthProvider + useAuth context
    permissions.tsx          usePermissions().can(flagId) hook
    constants.ts             Centralized constants (status maps, formatters)
    queryClient.ts           React Query config + apiRequest helper

apps/mobile/                 Expo React Native B2C app
plan/                        Dokumentasi teknis & plan fitur
```

### Lapisan Arsitektur Backend

```
Request → Fastify Route → preHandler (auth, RBAC) → Controller → Service → Repository → Database
                                                                        ↘ storage.ts facade (IStorage)
```

1. **Route** (`*.routes.ts`) — Definisi endpoint HTTP + middleware chain
2. **Controller** (`*.controller.ts`) — Parse request, validasi input, panggil service, format response
3. **Service** (`*.service.ts`) — Business logic, orchestrate repository calls, transaksi DB
4. **Repository** (`server/repositories/*.repository.ts`) — Raw SQL/Drizzle queries per domain
5. **Storage Facade** (`server/storage.ts`) — Thin facade delegasi ke repositories (IStorage interface)

### Module File Convention

Setiap module di `server/modules/` mengikuti pola:
```
server/modules/myFeature/
  myFeature.routes.ts      → registerMyFeatureRoutes(app) — endpoint registration
  myFeature.controller.ts  → Request/response handling
  myFeature.service.ts     → Business logic
```

---

## Panduan Membuat Fitur Baru

Berikut langkah-langkah untuk menambahkan fitur baru ke TransityTerminal:

### 1. Schema — Definisikan tabel di `shared/schema/`

Buat atau tambahkan di file domain yang sesuai (`shared/schema/<domain>.ts`):

```typescript
import { sql } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const myNewTable = pgTable("my_new_table", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertMyNewTableSchema = createInsertSchema(myNewTable).omit({ id: true, deletedAt: true });
export type InsertMyNewTable = z.infer<typeof insertMyNewTableSchema>;
export type MyNewTable = typeof myNewTable.$inferSelect;
```

Re-export dari `shared/schema/index.ts`, lalu jalankan `npm run db:push`.

**Konvensi:**
- UUID primary key (`uuid("id").primaryKey().default(sql\`gen_random_uuid()\`)`)
- Soft delete: `deletedAt: timestamp("deleted_at", { withTimezone: true })`
- Export: table definition, insert schema, insert type, select type

### 2. Repository — Tambah data access di `server/repositories/`

Tambah methods di repository domain yang sesuai. Semua query gunakan `isNull(table.deletedAt)` untuk filter soft-deleted records.

### 3. IStorage Interface — Update `server/storage.interface.ts`

Tambahkan method signatures baru ke interface `IStorage`.

### 4. Storage Facade — Update `server/storage.ts`

Tambahkan delegasi ke repository (satu baris per method):
```typescript
async getMyItems() { return this.xxxRepo.getMyItems(); }
```

### 5. Module — Buat folder `server/modules/myFeature/`

Buat 3 file:
- `myFeature.routes.ts` — `registerMyFeatureRoutes(app)` dengan endpoint definitions
- `myFeature.controller.ts` — Request/response handling
- `myFeature.service.ts` — Business logic

### 6. Register Routes — Update `server/routes.ts`

```typescript
import { registerMyFeatureRoutes } from "./modules/myFeature/myFeature.routes";
registerMyFeatureRoutes(app);
```

### 7. Frontend — Buat page + API functions

- Page di `client/src/pages/myFeature/MyFeaturePage.tsx`
- Lazy import + route di `client/src/App.tsx`
- API functions di `client/src/lib/api.ts`
- React Query dengan proper `queryKey` dan cache invalidation
- Sidebar menu item di `client/src/components/layout/Sidebar.tsx`

### 8. RBAC (opsional) — Tambah feature flag

```sql
INSERT INTO feature_flags (id, name, category) VALUES ('master.myFeature', 'My Feature', 'master');
INSERT INTO role_flags (role_id, flag_id, enabled) VALUES ('admin', 'master.myFeature', true);
```

Gunakan `requireFlag("master.myFeature")` di route preHandler, dan `usePermissions().can("master.myFeature")` di frontend.

### Checklist

- [ ] Schema + `db:push`
- [ ] Repository methods
- [ ] IStorage interface
- [ ] Storage facade
- [ ] Module (routes + controller + service)
- [ ] Register routes
- [ ] Frontend page + API + React Query
- [ ] Sidebar menu
- [ ] RBAC flags (jika perlu)
- [ ] `data-testid` pada elemen interaktif

---

## Status Fitur

| Fitur | Status |
|-------|--------|
| Master Data (Stops, Outlets, Vehicles, Layouts, Patterns) | Done |
| Trip Bases & Virtual Scheduling | Done |
| CSO Booking Terminal — Sekali Jalan (SeatMap, PassengerForm, Payment, Print) | Done |
| CSO Booking PP / Round-Trip (`useRoundTripFlow`, `RoundTripStepper`, `POST /api/bookings/round-trip`) | Done |
| `booking_groups` Table (penghubung outbound+return via `groupCode`) | Done |
| Seat Inventory & Hold System | Done |
| Pricing Engine (per-leg, flat, scope-based) | Done |
| Promo & Voucher | Done |
| Kargo Terminal | Done |
| Manifest & Thermal Print | Done |
| SPJ (Surat Perintah Jalan) | Done |
| Jadwal Harian | Done |
| Unseat / Reassign / Reschedule | Done |
| Booking History (Audit Trail) | Done |
| Reports (8 jenis laporan termasuk Commercial Fee) | Done |
| Authentication (Realmio) + Setup onboarding | Done |
| RBAC + ABAC + Feature Flags (33+ flags) | Done |
| Admin UI (Staff & Flag Management) | Done |
| Hybrid Refactor (Schema split, Repository pattern, Route decentralization) | Done |
| Data Integrity — Snapshot System | Done |
| Batch Reschedule on Trip Close | Done |
| Security Hardening (rate limit, CORS, webhook, redaction) | Done |
| Dashboard (ringkasan operasional harian) | Done |
| Kasir (sesi kasir open/close/approve, settlement breakdown) | Done |
| Refund (create/approve/process/reject, RBAC per role) | Done |
| Pelanggan / CRM (profil, tag, riwayat booking) | Done |
| Notifikasi in-app (bell icon, mark read) | Done |
| Operator Settings (branding: nama, logo, warna) | Done |
| Logout fix (clear cookie domain mismatch) | Done |
| Backend: Fastify 5 Migration | Done |
| Mobile B2C (Expo React Native) | In Progress |

---

## License

MIT
