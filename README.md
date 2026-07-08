# TransityTerminal

**Sistem Ticketing Bus Transit Multi-Operator**

TransityTerminal adalah sistem terminal/operator untuk ticketing bus, shuttle, dan travel multi-stop. Sistem ini mendukung operasional CSO, rute, perjalanan, kursi, reservasi, pembayaran, kargo, SPJ, manifest, kasir, refund, laporan, RBAC, realtime seat inventory, dan sinkronisasi schedule ke TransityConsole.

README ini adalah entrypoint project. Detail fitur tetap berada di `docs/FEATURES.md`; README ini merangkum kondisi codebase saat ini berdasarkan struktur `client/`, `server/`, `shared/schema/`, `migrations/`, `deploy/`, dan commit history terbaru.

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
| [15. Public App API](#public-app--ota-api) | Endpoint `/api/app/*` untuk customer-facing client / OTA |
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
- [Otorisasi RBAC + Feature Flags](#otorisasi-rbac--feature-flags)
- [Real-time Events](#real-time-events)
- [Reservation Engine Adapter](#reservation-engine-adapter)
- [Struktur Project](#struktur-project)
- [Deployment](#deployment)
- [Testing & CI](#testing--ci)
- [Status Codebase Saat Ini](#status-codebase-saat-ini)

---

## Fitur Utama

### Operasional

- **Terminal Reservasi CSO** — Flow reservasi internal operator dengan pencarian trip, seat map, passenger form, payment, hold kursi, dan print ticket.
- **Pulang Pergi (PP)** — Booking dua arah dalam satu transaksi melalui `booking_groups` dan flow round-trip service.
- **Jadwal Harian** — Unified daily schedule dengan driver assignment, manifest access, SPJ creation, dan status operasional trip.
- **Kargo** — Waybill, perhitungan tarif kargo, cargo type/rate, status lifecycle, dan tracking publik.
- **SPJ (Surat Perintah Jalan)** — Work order perjalanan, cost lines, settlement, dan kalkulasi biaya trip.
- **Manifest Perjalanan** — Manifest penumpang per trip dengan format print thermal 80mm.
- **Dashboard** — Ringkasan trip, booking, revenue, kargo, load factor, alert, dan recent bookings.
- **Kasir** — Buka/tutup sesi kasir, approval session, settlement breakdown, dan transaksi harian.
- **Refund** — Create, approve, process, reject refund dengan pembagian role CSO/manager/finance/owner.
- **Pelanggan (CRM)** — Profil pelanggan, tag pelanggan, dan riwayat booking.
- **Maintenance** — Modul maintenance operasional untuk kendaraan/aktivitas terkait armada.
- **Notifications** — Notifikasi internal untuk event operasional.

### Master Data

- **Halte / Stops** — Titik berhenti/terminal dengan koordinat GPS.
- **Outlet** — Lokasi penjualan tiket yang terhubung dengan stop.
- **Kendaraan / Vehicles** — Armada bus dengan kapasitas dan layout kursi.
- **Layout Kursi** — Konfigurasi visual kursi berbasis grid.
- **Pengemudi / Drivers** — Data pengemudi dan lisensi.
- **Trip Patterns** — Template rute dengan urutan stop dan aturan boarding/alighting.
- **Trip Bases** — Jadwal template yang dapat dimaterialisasi menjadi trip aktual.
- **Trips** — Instance perjalanan aktual/materialized.
- **Price Rules** — Harga dinamis berdasarkan pattern, trip, leg, waktu, dan channel.
- **Promotions & Vouchers** — Promo code, voucher generation, usage limit.
- **Cargo Types & Cargo Rates** — Tipe barang dan tarif kargo.

### Booking & Seat Management

- **Virtual → Real Trip** — Trip base dapat dimaterialisasi saat ada kebutuhan booking.
- **Seat Inventory** — Inventori kursi per seat dan per leg.
- **Seat Hold** — Hold kursi dengan TTL, expiry, release, dan confirm.
- **Unseat / Reassign / Reschedule** — Manajemen kursi lanjutan dengan reason note dan audit trail.
- **Batch Reschedule on Close** — Penanganan penumpang aktif saat trip ditutup/reschedule.
- **WebSocket Broadcast** — Update seat map real-time ke terminal CSO yang membuka trip yang sama.

### Laporan (Reports)

- Revenue report.
- Sales report.
- Trip profitability report.
- Load factor report.
- Cancellations report.
- Cargo report.
- Payments report.
- Commercial fee report.

Laporan memakai pendekatan snapshot untuk menjaga histori transaksi agar tidak berubah akibat perubahan master data di masa depan.

### Admin

- **Staff Management** — Manajemen user/staff terminal.
- **RBAC Roles** — Role, permission flag, outlet scoping, dan guard backend/frontend.
- **Feature Flags** — Toggle akses fitur per flag key.
- **Outlet Scoping** — Batasi akses data berdasarkan outlet user.
- **Settings** — Konfigurasi operator, integrasi Console, dan setting terminal.

### Public App / OTA API

Repo ini menyediakan API customer-facing di `/api/app/*`, misalnya auth app user, pencarian trip, booking, payment, voucher, review, dan cargo tracking.

Catatan penting: source aplikasi mobile penuh tidak menjadi bagian utama repo ini saat ini. Server hanya memiliki dukungan untuk melayani build `/mobile` jika artefak `apps/mobile/dist` tersedia, sedangkan flow utama repo tetap web terminal + backend API.

### TransityConsole Integration

- Schedule snapshot endpoint untuk Console.
- HMAC-signed webhook untuk schedule changes.
- Console connection status di settings.
- OTA booking lookup dan OTA payment confirmation.
- Service-to-service API memakai `X-Service-Key`.

---

## Arsitektur Sistem

```text
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React + Vite)                      │
│  CSO │ Schedule │ Manifest │ SPJ │ Cargo │ Reports │ Admin │ CRM   │
│                         Wouter + TanStack Query                    │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTP / WebSocket
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    SERVER (Fastify 5 + TypeScript)                 │
│  Env Guard │ CORS │ Helmet │ Rate Limit │ Metrics │ Logger │ RBAC  │
│                                                                    │
│  routes.ts                                                         │
│    ├── Auth / Realmio                                              │
│    ├── Terminal Protected API                                      │
│    ├── Public App API                                              │
│    ├── Console Service API                                         │
│    └── Health / Metrics                                            │
│                                                                    │
│  Modules                                                           │
│    bookings │ holds │ trips │ tripBases │ tripPatterns │ payments  │
│    cargo │ spj │ cashier │ refunds │ reports │ rbac │ settings    │
│                                                                    │
│  Repositories / Storage Facade                                     │
│  Socket.IO realtime                                                │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL DATABASE                        │
│  users │ fleet │ network │ scheduling │ inventory │ booking        │
│  cargo │ finance │ spj │ rbac │ notifications │ cashier │ refunds │
└────────────────────────────────────────────────────────────────────┘
```

### Runtime Bootstrap

Entry point server ada di `server/index.ts`.

Boot flow utama:

1. Load environment dari `server/lib/loadEnv`.
2. Init observability/Sentry jika dikonfigurasi.
3. Setup Fastify server.
4. Register security middleware: CORS, Helmet, rate limit, compression, raw body parser untuk webhook.
5. Register request context, metrics hook, logger, dan error handler.
6. Validate production environment.
7. Jalankan migration saat `RUN_MIGRATIONS_ON_BOOT !== false`.
8. Seed RBAC default.
9. Register semua route dari `server/routes.ts`.
10. Serve static frontend production dari `dist/public` atau Vite middleware saat development.
11. Init Socket.IO realtime service.
12. Start scheduler.

### Backend Layering

```text
Route
  → middleware / preHandler
  → controller
  → service
  → repository / storage facade
  → database
```

Pola ini belum sepenuhnya identik di semua module karena masih ada facade `server/storage.ts`, tetapi domain utama sudah dipisah ke `server/modules/*` dan `server/repositories/*`.

### Frontend Layering

```text
Page
  → component / hook
  → API client
  → TanStack Query
  → Fastify API
```

Frontend memakai:

- `client/src/App.tsx` sebagai router utama.
- `client/src/pages/*` untuk halaman domain.
- `client/src/components/*` untuk UI dan domain components.
- `client/src/hooks/*` untuk flow booking, seat hold, realtime, dan utilitas state.
- `client/src/lib/*` untuk API client, auth, permissions, dan query client.

---

## Tech Stack

### Backend

- **Runtime**: Node.js 20.
- **Language**: TypeScript ESM.
- **Framework**: Fastify 5.
- **ORM**: Drizzle ORM.
- **Database**: PostgreSQL / Neon-compatible PostgreSQL.
- **Validation**: Zod + drizzle-zod.
- **Realtime**: Socket.IO.
- **Logging**: Pino structured logging.
- **Observability**: Prometheus metrics via `prom-client`, Sentry optional.
- **Security**: Helmet, CORS guard, rate limiting, service key guard, production env guard.
- **Optional infra**: Redis untuk multi-instance WebSocket adapter dan rate-limit store.

### Frontend

- **Framework**: React 18.
- **Build Tool**: Vite 5.
- **Routing**: Wouter.
- **State/Data Fetching**: TanStack Query.
- **Styling**: Tailwind CSS dengan `tailwind.config.ts`.
- **UI Components**: Radix UI + shadcn-style components.
- **Icons**: Lucide React.
- **Charts**: Recharts.

### Tooling

- **Package Manager**: npm (`package-lock.json`).
- **Type Checking**: TypeScript.
- **Dev Server**: Vite middleware + Fastify.
- **Build Frontend**: Vite.
- **Build Backend**: esbuild.
- **Test Runner**: Vitest.
- **Container**: Docker multi-stage Node 20 Alpine image.

---

## Struktur Database

Schema Drizzle utama ada di `shared/schema/*` dan diekspor dari `shared/schema.ts`.

Domain schema utama:

```text
shared/schema/
├── enums.ts
├── users.ts
├── fleet.ts
├── network.ts
├── scheduling.ts
├── inventory.ts
├── booking.ts
├── cargo.ts
├── app-users.ts
├── promo.ts
├── finance.ts
├── spj.ts
├── reviews.ts
├── rbac.ts
├── notifications.ts
├── cashier.ts
├── refunds.ts
├── maintenance.ts
├── customers.ts
├── relations.ts
└── settings.ts
```

Migration SQL ada di `migrations/` dan saat ini disusun per domain:

```text
0001_extensions.sql
0002_enums.sql
0003_users.sql
0004_geography.sql
0005_fleet.sql
0006_rbac.sql
0007_promotions.sql
0008_app_users.sql
0009_scheduling_patterns.sql
0010_scheduling_bases.sql
0011_trips.sql
0012_inventory_and_holds.sql
0013_pricing.sql
0014_bookings_core.sql
0015_bookings_extras.sql
0016_cargo.sql
0017_spj.sql
0018_cashier.sql
0019_engine_integration.sql
0020_settings_and_notifications.sql
0021_views.sql
```

### Migration Runner

- `server/migrator.ts` menjalankan migration SQL.
- `server/migrate.ts` menjalankan safety-net migration untuk kompatibilitas user/staff table.
- `scripts/db-migrate.ts` menjalankan kedua migration path sebagai deploy step.
- `npm run db:push` tersedia untuk sync Drizzle saat development.

---

## Instalasi

### 1. Clone repo

```bash
git clone <repo-url>
cd transity-terminal
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Siapkan environment

```bash
cp .env.example .env
```

Minimal development lokal:

```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/transity_terminal
JWT_SECRET=dev-secret-minimum-32-characters-long
DEV_BYPASS_AUTH=true
```

### 4. Sync database

```bash
npm run db:push
```

Atau jalankan migration runner:

```bash
npx tsx scripts/db-migrate.ts
```

### 5. Seed data demo

```bash
npx tsx server/seeds/index.ts buskita
```

Dataset lain:

```bash
npx tsx server/seeds/index.ts nusa
```

### 6. Run development server

```bash
npm run dev
```

Default port runtime adalah `5000`.

---

## Konfigurasi

Environment utama tersedia di `.env.example`.

### Core Runtime

| Variable | Keterangan |
|----------|------------|
| `NODE_ENV` | `development`, `test`, atau `production`. |
| `PORT` | Port aplikasi. Default `5000`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `OPERATOR_SLUG` | Slug operator/container. |
| `OPERATOR_TZ` | Timezone operator. Default `Asia/Jakarta`. |
| `HOST_PORT` | Port host saat Docker compose. |
| `RUN_MIGRATIONS_ON_BOOT` | Jalankan migration saat boot. Default aktif. |

### Auth & Security

| Variable | Keterangan |
|----------|------------|
| `REALMIO_BASE_URL` | Base URL Realmio auth service. |
| `REALMIO_TENANT_ID` | Tenant ID operator. |
| `JWT_SECRET` | Secret JWT internal app/customer API. Wajib production. |
| `TERMINAL_SERVICE_KEY` | Service key untuk Console/OTA/internal integration. |
| `APP_CORS_ORIGINS` | Origin HTTP API yang diizinkan. |
| `CORS_ORIGINS` | Origin WebSocket yang diizinkan. |
| `DEV_BYPASS_AUTH` | Development-only auth bypass. Jangan aktif di production. |

### Console Sync

| Variable | Keterangan |
|----------|------------|
| `CONSOLE_URL` | Base URL TransityConsole. |
| `CONSOLE_OPERATOR_SLUG` | Slug operator di Console. |
| `CONSOLE_WEBHOOK_SECRET` | Secret HMAC webhook schedule. |
| `CONSOLE_SYNC_ENABLED` | Enable/disable sync scheduler. |
| `CONSOLE_SNAPSHOT_INTERVAL_MS` | Interval push snapshot schedule. |
| `CONSOLE_SNAPSHOT_DAYS_AHEAD` | Jumlah hari ke depan untuk snapshot. |
| `CONSOLE_SNAPSHOT_MAX_TRIPS` | Guard maksimum trip per snapshot. |
| `SCHEDULE_SNAPSHOT_GRACE_MINUTES` | Grace period trip lampau sebelum diskip. |

### Reservation Engine

| Variable | Keterangan |
|----------|------------|
| `RESERVATION_ENGINE_ENABLED` | Enable adapter engine eksternal. Default `false`. |
| `RESERVATION_ENGINE_URL` | URL reservation engine sidecar. |
| `RESERVATION_ENGINE_HMAC_SECRET` | Secret HMAC untuk komunikasi Terminal ↔ Engine. |
| `RESERVATION_ENGINE_TIMEOUT_MS` | Timeout request engine. |
| `RESERVATION_ENGINE_MAX_RETRIES` | Retry request engine. |

### Optional Infra

| Variable | Keterangan |
|----------|------------|
| `REDIS_URL` | Redis untuk Socket.IO adapter/rate-limit store. |
| `SENTRY_DSN` | Sentry DSN jika observability external diaktifkan. |
| `PAYMENT_WEBHOOK_SECRET` | Secret webhook pembayaran. |

---

## API Endpoints

### Health & Observability

```http
GET /api/health
GET /api/health/deep
GET /api/health/clock
GET /api/metrics
```

### Auth & Setup

```http
POST /api/auth/sign-in/email
POST /api/auth/sign-up/email
POST /api/auth/sign-out
GET  /api/auth/session
GET  /api/auth/me
GET  /api/setup/status
POST /api/setup/init
```

### Terminal Internal API

Protected API untuk staff terminal:

```http
/api/stops/*
/api/outlets/*
/api/vehicles/*
/api/layouts/*
/api/drivers/*
/api/trip-patterns/*
/api/trip-bases/*
/api/trips/*
/api/bookings/*
/api/payments/*
/api/cargo/*
/api/spj/*
/api/reports/*
/api/admin/*
/api/scheduler/*
/api/dashboard/*
/api/notifications/*
/api/cashier/*
/api/refunds/*
/api/maintenance/*
/api/customers/*
/api/settings/*
```

### Public App / OTA API

Endpoint customer-facing / OTA / service client:

```http
/api/app/auth/*
/api/app/profile
/api/app/operator-info
/api/app/cities
/api/app/service-lines
/api/app/trips/search
/api/app/trips/:id
/api/app/trips/:id/seatmap
/api/app/trips/:id/reviews
/api/app/bookings/*
/api/app/payments/*
/api/app/vouchers/validate
/api/app/cargo/*
/api/app/reviews
```

### Console API

```http
GET /api/console/schedules
```

Endpoint Console memakai `X-Service-Key`, ETag/cache, filter service date, channel, route, limit, dan snapshot-size guard.

---

## Alur Booking

```text
Pilih route / tanggal / trip
    ↓
Materialisasi trip jika masih virtual
    ↓
Load seat map dan leg inventory
    ↓
Hold seat dengan TTL
    ↓
Isi passenger form
    ↓
Hitung harga + promo/voucher
    ↓
Create booking + payment
    ↓
Confirm seat inventory
    ↓
Print ticket / manifest / realtime broadcast
```

### Prinsip Inventory

- Seat inventory dihitung per seat dan per leg.
- Hold mencegah double booking selama TTL aktif.
- Pending booking dan expired hold dibersihkan otomatis oleh scheduler.
- Realtime event dipakai agar beberapa terminal CSO melihat perubahan kursi yang sama.
- Adapter engine bisa mengambil alih operasi inventory saat `RESERVATION_ENGINE_ENABLED=true`.

---

## Virtual Scheduling

TransityTerminal memisahkan jadwal template dan trip aktual:

```text
trip_patterns
    ↓
trip_bases
    ↓
materialized trips
    ↓
trip stop times + trip legs
    ↓
seat inventory
```

- `trip_patterns` menentukan rute dan stop sequence.
- `trip_bases` menentukan jadwal template/operator schedule.
- `trips` adalah instance aktual yang dipakai booking, manifest, SPJ, dan reports.
- Trip dapat dimaterialisasi saat dibutuhkan agar database tidak penuh oleh jadwal kosong.

---

## Otorisasi RBAC + Feature Flags

Sistem akses memakai kombinasi:

- Realmio / staff identity.
- Role-based access control.
- Feature flags.
- Outlet scoping.
- Backend middleware guard.
- Frontend guard via permission provider dan `RequireFlag`.

Contoh role operasional:

```text
owner
manager
finance
spv_operations
operations
spv_cso
cso
```

RBAC seed berada di module/seeds RBAC dan disiapkan saat boot/deploy agar role dasar tersedia.

---

## Real-time Events

Realtime memakai Socket.IO.

Fungsi utama:

- Seat map update.
- Hold created/released/expired.
- Booking confirmed/cancelled/rescheduled.
- Trip/base schedule update.
- Room per trip/base/CSO.
- Optional Redis adapter untuk multi-instance.

WebSocket auth mendukung staff/session, app user, service client, dan anonymous mode sesuai kebutuhan route/event.

---

## Reservation Engine Adapter

Repo ini memiliki adapter untuk mengalihkan operasi seat inventory ke reservation engine eksternal.

Default local mode:

```env
RESERVATION_ENGINE_ENABLED=false
```

Engine mode:

```env
RESERVATION_ENGINE_ENABLED=true
RESERVATION_ENGINE_URL=http://engine:8000
RESERVATION_ENGINE_HMAC_SECRET=replace-with-strong-secret
```

File penting:

```text
server/modules/holds/holdsAdapter.ts
server/modules/holds/engineClient.ts
server/modules/holds/engineClient.types.ts
deploy/engine/docker-compose.engine.yml
deploy/engine/README.md
docs/RESERVATION_ENGINE_CONTRACT.md
```

Operasi yang dapat dirutekan ke engine:

- hold.
- release.
- confirm.
- hold for booking.
- release for booking.
- cancel seats.
- reschedule helper.
- compensation/rollback queue untuk partial failure.

---

## Struktur Project

```text
.
├── client/
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       └── lib/
│
├── server/
│   ├── index.ts
│   ├── routes.ts
│   ├── db.ts
│   ├── migrator.ts
│   ├── migrate.ts
│   ├── scheduler.ts
│   ├── vite.ts
│   ├── realtime/
│   ├── repositories/
│   ├── modules/
│   ├── observability/
│   ├── seeds/
│   └── lib/
│
├── shared/
│   ├── schema.ts
│   └── schema/
│
├── migrations/
├── tests/
├── docs/
├── deploy/engine/
├── scripts/
├── Dockerfile
├── docker-compose.yml
├── deploy.sh
├── package.json
├── vite.config.ts
├── drizzle.config.ts
└── esbuild.config.js
```

---

## Deployment

### Build Lokal

```bash
npm run build
```

Build menghasilkan:

- frontend static output di `dist/public`.
- backend bundle di `dist/index.js`.

### Start Production

```bash
npm start
```

### Docker

```bash
cp .env.example .env
# isi .env sesuai operator

docker network create transity-terminals-net || true
./deploy.sh
```

`docker-compose.yml` menjalankan terminal di container port `5000` dan bind ke host `127.0.0.1:${HOST_PORT}:5000`. Untuk publik, biasanya dipasang reverse proxy/Nginx per subdomain operator.

### Engine Overlay

```bash
docker compose \
  -f docker-compose.yml \
  -f deploy/engine/docker-compose.engine.yml \
  up -d --build
```

---

## Testing & CI

Command utama:

```bash
npm run check
npx vitest run
npm audit --omit=dev --audit-level=high
```

CI berada di:

```text
.github/workflows/ci.yml
```

Catatan kondisi saat ini:

- TypeScript check tersedia via `npm run check`.
- Vitest test suite tersedia di `tests/`.
- CI sudah menjalankan install, typecheck, db push, vitest, audit, dan lint placeholder.
- Sebagian quality gate di workflow masih bersifat non-blocking (`continue-on-error`), jadi status CI perlu dibaca bersama output step-nya.

---

## Status Codebase Saat Ini

Bagian ini sengaja dipisah agar README tetap rapi, tetapi engineer tidak salah asumsi dari dokumentasi historis.

- Web terminal aktif berada di `client/src`.
- Backend aktif berada di `server`.
- Shared schema aktif berada di `shared/schema/*`.
- Migration aktif berada di `migrations/0001` sampai `0021`.
- Public/customer-facing capability tersedia sebagai API `/api/app/*`.
- Source aplikasi mobile penuh tidak menjadi bagian utama repo ini saat ini; README tidak lagi mengklaim `/apps/mobile` sebagai source app aktif.
- Reservation engine source tidak berada di repo ini; repo ini berisi adapter, contract docs, dan deployment overlay.
- Docker compose masih perlu dicek bersama route health aktif sebelum mengandalkan container health status di environment production.
- Beberapa dokumen di `docs/terminal-readiness` bersifat historis/readiness notes. Jika ada perbedaan dengan kode, gunakan kode aktif sebagai source of truth.

---

## License

MIT
