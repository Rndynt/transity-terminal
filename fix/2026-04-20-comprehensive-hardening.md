# 2026-04-20 — Comprehensive Hardening Checklist

> **Untuk agent lain:** file ini adalah single source of truth untuk batch perbaikan keamanan, performa, konkurensi, dan skalabilitas TransityTerminal hasil audit 2026-04-20. Setiap item punya:
>
> - **Status**: `[ ]` belum, `[x]` selesai, `[~]` sebagian/skipped
> - **File:line** referensi
> - **Risk**: dampak jika tidak diperbaiki
> - **Fix**: pendekatan yang dipakai
>
> Saat menambah/memperbaiki, **update checkbox + tulis catatan singkat** di kolom Notes. Jangan menyentuh `replit.md`, `package.json`, `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts`, atau `.replit`.

---

## SPRINT 1 — Stop the Bleeding (Critical, Low Risk)

### [x] P1 — Tambah index DB untuk hot tables
- **Risk**: Query laporan & seatmap akan slow saat data >100K rows.
- **Files**: `shared/schema/booking.ts`, `shared/schema/cargo.ts`, `shared/schema/scheduling.ts`, `shared/schema/customers.ts`, `shared/schema/app-users.ts`, `shared/schema/notifications.ts`, `shared/schema/finance.ts`, `shared/schema/reviews.ts`, `shared/schema/fleet.ts`, `shared/schema/promo.ts`
- **Fix**: tambah index pada FK + kolom yang sering difilter:
  - `bookings`: `app_user_id`, `group_id`, `origin_stop_id`, `destination_stop_id`, `(outlet_id, created_at desc)`, partial-unique `idempotency_key`
  - `cargo_shipments`: `(trip_id, status)`, `paid_at`, `(outlet_id, created_at desc)`, `cargo_type_id`
  - `trips`: `(pattern_id, service_date)`, `(base_id, service_date)`, `(service_date, status)`
  - `app_users`: partial `phone`, partial `is_active`
  - `customers`: `phone`, `id_number`, `email`, `tag`
  - `notifications`: per-user, per-outlet (created desc), unread partial, expires_at partial
  - `reviews`: `(trip_id, created_at desc)`, `app_user_id`, `booking_id`
  - `cost_templates`: `(pattern_id, is_active)`
  - `drivers`: status partial (deleted_at null)
  - `promotions`: active+valid_from/to partial
- **Notes**: 22 index baru ditambah. `npm run db:push` sukses (changes applied). Total index database: 76 (sebelumnya 54).

### [x] B1 — Idempotency check di createBooking
- **Risk**: Network retry → double booking + double charge.
- **File**: `server/modules/bookings/bookings.service.ts:88-110`, `shared/schema/booking.ts`
- **Fix**:
  1. Tambah kolom `idempotency_key text` + partial unique index `WHERE idempotency_key IS NOT NULL`. ✓
  2. Sebelum transaksi, jika `idempotencyKey` ada → SELECT booking dengan key tsb. Kalau ada → return langsung (re-generate print payload). ✓
  3. INSERT booking dengan kolom `idempotency_key` set. ✓ Race-loss tetap dihandle global handler 23505.
- **Notes**: Implementasi minimal & non-breaking; idempotencyKey tetap optional.

### [x] B3 — WebSocket emit di luar transaksi
- **Risk**: Klien diberi tahu trip yang gagal commit → ghost trip di seatmap.
- **File**: `server/modules/tripBases/tripBases.service.ts:218-362`
- **Fix**: Restrukturisasi `ensureMaterializedTrip` — emit `emitTripMaterialized` & `emitTripWebhook` setelah blok try/catch selesai dan hanya untuk path freshly-created (race-loss path tidak re-emit karena pemenang sudah emit).
- **Notes**: Memakai flag `isFreshlyCreated` + `tripIdResolved` untuk path bersama.

### [x] B5 — RBAC pada SPJ read routes
- **Risk**: Staff biasa bisa lihat profit margin & driver assignment semua trip.
- **File**: `server/modules/spj/spj.routes.ts`
- **Fix**: Tambah `preHandler: [requireFlag('page.spj')]` ke semua GET (`/api/spj`, `/:id`, `/trip/:tripId`, `/trip/:tripId/profit`).
- **Notes**: Memakai flag existing `page.spj` (sudah dipakai role mapping).

### [x] B7 — RBAC + rate-limit pada booking search by code
- **Risk**: Enumeration booking code → leak data penumpang.
- **File**: `server/modules/bookings/bookings.routes.ts:30-35`
- **Fix**: Tambah `preHandler: [requireFlag('page.bookings')]` + per-route rate limit `30/menit`.
- **Notes**: Endpoint `/api/bookings/by-code/:code` tetap dipertahankan untuk lookup kasir; di-cover oleh global rate limit (B11).

### [x] B9 — Disable response body logging di production
- **Risk**: Bocor token/PII; mahal di event loop.
- **File**: `server/index.ts:37-38, 95`
- **Fix**: Body hanya di-log jika `NODE_ENV !== 'production'` ATAU `LOG_BODIES=true`. Production → hanya `method path status duration`.
- **Notes**: Konstanta `LOG_RESPONSE_BODIES` di-evaluate sekali di boot.

---

## SPRINT 2 — Hardening (Important)

### [x] B4 — Cargo update atomic
- **Risk**: Status transition bypass via concurrent request.
- **File**: `server/modules/cargo/cargo.service.ts:124-166`
- **Fix**: `updateShipment` & `updateShipmentStatus` sekarang dalam `db.transaction` + `SELECT ... FOR UPDATE` pada baris shipment sebelum read-current-state lalu apply transition.
- **Notes**:

### [x] B2 — Seat-confirm locking (FOR UPDATE)
- **Risk**: Hold expired & diambil orang lain antara validasi & confirm → 2 booking.
- **File**: `server/modules/bookings/booking.helpers.ts:184-220`
- **Fix**: `confirmSeatsBooked` sekarang `SELECT ... FOR UPDATE` pada `seat_inventory` rows yang akan diubah, lalu assert tidak ada row dengan `booked = true` sebelum update. Race window antara `validateHoldOwnership` (luar tx) dan confirm tertutup.
- **Notes**: Versi minimal — full move ke dalam tx perlu refactor besar.

### [x] B10 — JWT TTL pendek
- **Risk**: Token tercuri = akses 30 hari, tidak bisa logout server-side.
- **File**: `server/modules/app/app.auth.ts:26-30`
- **Fix**: Default TTL `24h` (dari `30d`), env-override via `JWT_TTL`.
- **Notes**: Refresh-token rotation defer; cukup turunkan blast radius dulu.

### [x] B11 — Global rate limit aktif
- **Risk**: API service-key bisa di-flood.
- **File**: `server/index.ts:47-52`
- **Fix**: `global: true, max: 300/menit` (env-overridable via `RATE_LIMIT_MAX` & `RATE_LIMIT_WINDOW`), allowList untuk health endpoints.
- **Notes**: Override per-route untuk endpoint mahal sudah ada (booking search 30/menit, login 10/menit).

### [ ] P3 — Reports query optimization (functional indexes)
- **Risk**: Reports lambat seiring data tumbuh karena `paid_at::date` cast tidak match index.
- **File**: `server/repositories/reports.repository.ts:27,135-217`
- **Fix**:
  - Tambah functional index `((paid_at::date))` di `payments` & `cargo_shipments` (paid_at base index sudah di P1).
  - Optional: ganti `EXISTS` subquery dengan `JOIN payments` untuk PaidAt mode.
- **Notes**:

### [~] P5 — Pagination paksa pada list endpoints
- **Risk**: Endpoint return 100K rows kalau client tidak kirim limit.
- **Files**: `server/repositories/booking.repository.ts:14-33`
- **Fix**: `getBookings()` sekarang capped: default 200, max 1000 row. Helper `clampPageSize` siap untuk dipakai endpoint paginasi lain.
- **Notes**: scheduling.repository belum disentuh — sebagian besar query trip sudah filter by date jadi risiko lebih kecil. Defer untuk audit terpisah agar tidak ganggu manifest/seatmap loader.

---

## SPRINT 3 — Scaling Readiness (Multi-Instance)

### [x] S3 — Postgres advisory lock untuk scheduler
- **Risk**: Multi-instance → cleanup & snapshot push 3x dijalankan.
- **File**: `server/scheduler.ts:11-27, 169-207`
- **Fix**: Helper `withAdvisoryLock(lockId, fn)` membungkus tiap job (`cleanupExpiredHolds`, `cleanupOrphanHoldRefs`, `cleanupExpiredPendingBookings`, `pushScheduleSnapshot`) dengan `pg_try_advisory_lock`. Instance yang tidak dapat lock skip sampai cycle berikutnya.
- **Notes**: Lock IDs `8240001..8240004`.

### [~] S1 — Socket.io Redis adapter (DEFERRED)
- **Risk**: Multi-instance WS → emit di node A tidak sampai client di node B.
- **File**: `server/realtime/ws.ts:30`
- **Reason defer**: butuh dependency Redis baru + env var. Akan ditambah saat user putuskan untuk scale-out.
- **Notes**: Dokumentasi di docs/DEPLOY_VPS_DOCKER.md sudah mengingatkan.

### [~] S2 — Rate limit Redis store (DEFERRED)
- **Risk**: Limit per-instance → total real = N × limit.
- **File**: `server/index.ts:47`
- **Reason defer**: tied dengan S1 (Redis dep). Saat ini limit per-instance OK karena single-instance deployment.
- **Notes**:

### [x] S4 — Mobile app dist note
- **File**: `server/index.ts:154-158`
- **Fix**: Komentar dokumentasi ditambahkan menjelaskan implikasi multi-instance untuk `apps/mobile/dist`.
- **Notes**:

---

## QUICK WINS (Quality)

### [ ] Q1 — Ganti `console.log` dengan logger Fastify (server/)
- **Risk**: Log tidak terstruktur, sulit di-filter di production.
- **Files**: `server/scheduler.ts`, dll. (~33 occurrences)
- **Fix**: Replace `console.log` → `app.log.info` / `app.log.warn` / `app.log.error`. Untuk module yang tidak punya akses `app`, biarkan `console.log` tapi prefix `[MODULE]`.
- **Notes**: Skip jika tidak ada akses ke fastify instance — keep `console.*` dengan prefix.

### [ ] Q5 — Waybill collision: pakai sequence Postgres
- **Risk**: 20 retry brute-force tidak deterministic, brittle string-match.
- **File**: `server/modules/cargo/cargo.service.ts:105-118`
- **Fix**: Buat sequence `cargo_waybill_seq`, format `WB-YYMMDD-{nextval:6d}`. Hapus retry loop.
- **Notes**: Optional — defer jika tidak ada bug nyata.

### [x] Q6 — bodyLimit Fastify
- **Risk**: Custom JSON parser memuat body besar ke memory.
- **File**: `server/index.ts:32-35`
- **Fix**: `Fastify({ bodyLimit: 1_048_576 })` (1 MB).
- **Notes**: Webhook payment payload kecil (<10 KB) — 1 MB cukup.

### [x] Q7 — AbortSignal.timeout di Realmio fetch
- **Risk**: Realmio lambat → request Terminal stuck.
- **File**: `server/modules/auth/realmio.ts:53-56, 126-134`
- **Fix**: `verifyWithRealmio` → 5s timeout; `createRealmioUser` → 8s timeout (signup lebih lama).
- **Notes**:

---

## DEFERRED (perlu diskusi user atau effort besar)

- **Q2** — Pecah `app.service.ts` (1828 LOC). Big refactor, butuh test coverage.
- **Q3** — Pecah `scheduling.repository.ts` (1269 LOC). Sda.
- **Q4** — TanStack Query staleTime default. Perlu evaluasi per-query (beberapa harus realtime).
- **B6** — Verifikasi signature webhook Console masuk. Saat ini Console **belum** push back ke Terminal, jadi tidak urgent. Saat fitur ditambahkan baru implement.
- **B8** — Settings PUT body validation. Akan dihandle saat refactor settings module.
- **B12** — CORS reflect Origin. Sudah aman selama `APP_CORS_ORIGINS != '*'` di production. Tambahkan guard bahwa `*` tidak boleh di production.

---

## EXECUTION LOG

| Time | Item | Status | Notes |
|------|------|--------|-------|
| 2026-04-20 19:30 | P1 (indexes 22 baru) | DONE | db:push sukses; total 76 index |
| 2026-04-20 19:32 | B1 idempotency | DONE | column + partial unique + service guard |
| 2026-04-20 19:33 | B3 WS emit | DONE | restructured ensureMaterializedTrip |
| 2026-04-20 19:34 | B5 SPJ RBAC | DONE | page.spj on 4 GET routes |
| 2026-04-20 19:34 | B7 booking search | DONE | RBAC + 30/min rate limit |
| 2026-04-20 19:34 | B9 logger production | DONE | LOG_RESPONSE_BODIES guard |
| 2026-04-20 19:35 | B11 global rate limit | DONE | 300/min env-overridable, health allowList |
| 2026-04-20 19:35 | Q6 bodyLimit | DONE | 1 MB |
| 2026-04-20 19:38 | B10 JWT TTL | DONE | 30d → 24h, env override |
| 2026-04-20 19:38 | Q7 Realmio timeout | DONE | 5s/8s AbortSignal |
| 2026-04-20 19:39 | B4 cargo atomic | DONE | tx + FOR UPDATE pada cargo_shipments |
| 2026-04-20 19:39 | B2 seat confirm lock | DONE | FOR UPDATE + booked-conflict assert |
| 2026-04-20 19:40 | S3 advisory lock | DONE | per-job pg_try_advisory_lock di scheduler |
| 2026-04-20 19:40 | S4 mobile dist note | DONE | komentar multi-instance |
| 2026-04-20 19:41 | P5 booking pagination | PARTIAL | bookings capped 200/1000; scheduling defer |
