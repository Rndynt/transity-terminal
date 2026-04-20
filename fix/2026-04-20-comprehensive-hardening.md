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
- **File**: `server/modules/bookings/bookings.service.ts:93-211`, `shared/schema/booking.ts:54,68`
- **Fix**:
  1. Kolom `idempotency_key text` + partial unique index `uniq_bookings_idempotency_key WHERE idempotency_key IS NOT NULL`. ✓
  2. Pre-check: jika ada → return existing booking + re-generate print payload. ✓
  3. INSERT dengan kolom diset; partial unique index meng-enforce di DB. ✓
  4. **Race-loss path**: tx.insert membungkus dalam try/catch. Pada `23505` dengan constraint `uniq_bookings_idempotency_key` (atau nama yang berisi `idempotency_key`), fetch booking pemenang dan return — bukan 500. ✓
- **Notes**: Race window pre-check↔INSERT sekarang tertutup end-to-end.

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

### [x] B4 — Cargo update atomic (end-to-end)
- **Risk**: Status transition bypass via concurrent request.
- **File**: `server/modules/cargo/cargo.service.ts:138-191`
- **Fix**: `updateShipment` & `updateShipmentStatus` dalam `db.transaction` + `SELECT ... FOR UPDATE`. **Update sekarang pakai `tx.update(cargoShipments)` langsung** (bukan `storage.updateCargoShipment` yang pakai global `db`) → lock & write di koneksi yang sama. ✓
- **Notes**: Race transition-table sekarang benar-benar atomic.

### [x] B2 — Seat-confirm locking + holdRef ownership re-assert
- **Risk**: Hold expired & diambil orang lain antara validasi & confirm → 2 booking.
- **File**: `server/modules/bookings/booking.helpers.ts:184-258`
- **Fix**:
  1. `SELECT ... FOR UPDATE` pada `seat_inventory` rows + assert tidak ada `booked = true`. ✓
  2. **Tambahan**: `SELECT ... FOR UPDATE` pada `seat_holds` untuk operatorId yg sama + non-expired, lalu assert tiap `seatNo` punya hold valid yang cover semua `legIndexes`. Jika hold di-reap scheduler atau diambil operator lain antara `validateHoldOwnership` luar tx dan confirm dalam tx → throw `hold ownership lost`. ✓
- **Notes**: Race window outer-validate ↔ inner-confirm sekarang tertutup penuh.

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

### [x] P3 — Reports functional indexes
- **Risk**: Reports lambat karena `paid_at::date` cast tidak match index.
- **File**: `shared/schema/booking.ts:112` (payments), `shared/schema/cargo.ts:87` (cargo_shipments)
- **Fix**:
  - `idx_payments_paid_date ON payments ((paid_at::date)) WHERE status = 'success'` ✓
  - `idx_cargo_paid_date ON cargo_shipments ((paid_at::date)) WHERE paid_at IS NOT NULL` ✓
  - `npm run db:push` sukses applied.
- **Notes**: EXISTS→JOIN refactor di-defer; functional index saja sudah signifikan.

### [x] P5 — Pagination paksa pada list endpoints
- **Risk**: Endpoint return 100K rows kalau client tidak kirim limit.
- **Files**: `server/repositories/booking.repository.ts:14-33`, `server/repositories/scheduling.repository.ts:162-247`
- **Fix**:
  - `getBookings()` capped: default 200, max 1000. ✓
  - `getTrips(serviceDate?, opts?)` capped: default 500, max 2000. ✓
  - `getTripsForDateRange(from, to, opts?)` capped: default 1000, max 2000. ✓
- **Notes**: Caller existing tidak pass `opts` → otomatis pakai default cap. Backward compatible.

---

## SPRINT 3 — Scaling Readiness (Multi-Instance)

### [x] S3 — Postgres advisory lock untuk scheduler (pinned client)
- **Risk**: Multi-instance → cleanup & snapshot push 3x dijalankan.
- **File**: `server/scheduler.ts:15-35, 181-216`
- **Fix**: `withAdvisoryLock(lockId, fn)` sekarang pinned-client: `pool.connect()` → acquire lock → run fn → release lock → `client.release()`. Acquire & unlock dijamin di koneksi yang sama (session-level lock semantics). ✓
- **Notes**: Lock IDs `8240001..8240004`. Bug pooled-conn (lock acquire/release split-conn) sudah diperbaiki.

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

### [x] Q1 — `console.*` di server/
- **Risk**: Log tidak terstruktur, sulit di-filter di production.
- **Files refactored ke `req.log.*`**:
  - `server/modules/bookings/bookings.controller.ts` (9 occurrences)
  - `server/modules/bookings/roundTrip.controller.ts` (2)
  - `server/modules/pricing/pricing.controller.ts` (1)
  - `server/modules/reports/reports.controller.ts` (9)
  - `server/modules/app/app.controller.ts` (4 — debug-gated + webhook error)
- **Pattern**: `req.log.error({ err: error }, 'message')` (struktur Pino-compatible). Debug logs (`searchTrips`, `getTripDetail` stop dump) diguard `req.log.level === 'debug'`.
- **Files yang sengaja tetap `console.*`**: `server/scheduler.ts`, `server/migrator.ts`, RBAC seeds, dev scripts — modul ini boot-time/background tanpa akses ke Fastify request, prefix-tagged sudah cukup untuk log shipper.
- **Notes**: Total 25+ console call di hot-path controllers sudah di-refactor.

### [x] Q5 — Waybill: Postgres sequence
- **Risk**: 20 retry brute-force tidak deterministic, brittle string-match constraint name.
- **File**: `server/modules/cargo/cargo.service.ts:36-47, 126-135`, `server/migrator.ts:93-101`
- **Fix**:
  - Sequence `cargo_waybill_seq` dibuat via `CREATE SEQUENCE IF NOT EXISTS` di migrator. ✓
  - `generateWaybillFromSequence()` → `WB-YYMMDD-{nextval:6d}`. ✓
  - Retry loop dihapus; fallback ke generator legacy random hanya jika sequence call gagal (defensive). ✓
- **Notes**: Deterministic & collision-free.

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

## ADDITIONAL FIXES (post-architect review)

### [x] B8 — Settings PUT/POST body validation
- **Risk**: Body apapun bisa masuk → write field tak terduga + tidak ada validasi format warna/URL.
- **File**: `server/modules/settings/settings.routes.ts:8-23, 42-71, 73-89`
- **Fix**: Tambah Zod schema `updateSettingsSchema` (strict, hex color regex `#RRGGBB`, URL validation untuk `logoUrl`) untuk PUT `/api/settings`, dan `logoBodySchema` untuk POST `/api/settings/logo`. Return 400 dengan `details` flatten kalau invalid. ✓
- **Notes**: `.strict()` menolak field yang tidak dikenal.

### [x] B12 — CORS guard production
- **Risk**: WS server bisa accept dari origin manapun di production kalau `CORS_ORIGINS` lupa di-set.
- **File**: `server/realtime/ws.ts:29-45`
- **Fix**: Logic sekarang: kalau `CORS_ORIGINS=*` atau tidak diset di production → CLOSE (false) + log warning. Hanya buka cross-origin kalau `CORS_ORIGINS` berisi list domain valid. Development tetap permisif. ✓
- **Notes**: Default-deny di production menutup foot-gun deploy.

## DEFERRED (perlu diskusi user atau effort besar)

- **Q2** — Pecah `app.service.ts` (1828 LOC). Big refactor, butuh test coverage. Skip — pure refactor tanpa benefit functional, risiko regression tinggi.
- **Q3** — Pecah `scheduling.repository.ts` (1269 LOC). Sda.
- **Q4** — TanStack Query staleTime — sudah set global `5 menit` di `client/src/lib/queryClient.ts:50` dengan `refetchOnWindowFocus: false` & `refetchInterval: false`. Dianggap CUKUP; per-query tuning bisa dilakukan saat ada keluhan UX spesifik.
- **B6** — Verifikasi signature webhook dari Console. Saat ini Console **tidak** push ke Terminal (consoleWebhook.ts hanya outbound). Tidak ada inbound endpoint dari Console → tidak ada surface untuk diserang. Implement saat Console push-back ditambahkan.
- **S1/S2** — Redis adapter (Socket.io & rate-limit). Perlu install `@socket.io/redis-adapter` + `ioredis` + env `REDIS_URL`. Tetap defer sampai user putuskan deploy multi-instance.

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
| 2026-04-20 19:53 | S3 pinned-client lock | FIX | `pool.connect()` — acquire/release di conn sama |
| 2026-04-20 19:53 | B4 tx end-to-end | FIX | `tx.update(cargoShipments)` langsung |
| 2026-04-20 19:53 | B1 race-loss handler | FIX | catch 23505 uniq_bookings_idempotency_key → return existing |
| 2026-04-20 19:53 | B2 holdRef under lock | FIX | re-assert hold ownership FOR UPDATE di tx |
| 2026-04-20 19:54 | P3 functional indexes | DONE | idx_payments_paid_date + idx_cargo_paid_date |
| 2026-04-20 19:54 | Q5 waybill sequence | DONE | cargo_waybill_seq + nextval, no retry |
| 2026-04-20 19:54 | Q1 console.log audit | PARTIAL | prefix-tagged sudah acceptable; full refactor defer |
| 2026-04-20 20:00 | B12 CORS guard | DONE | ws.ts default-deny di production tanpa CORS_ORIGINS |
| 2026-04-20 20:00 | B8 settings validation | DONE | Zod safeParse strict + hex color + URL |
| 2026-04-20 20:00 | P5 scheduling pagination | DONE | getTrips/getTripsForDateRange capped 500/1000-2000 |
| 2026-04-20 20:01 | Q1 controller logger | DONE | 25+ console.* → req.log.* di 5 controllers |
