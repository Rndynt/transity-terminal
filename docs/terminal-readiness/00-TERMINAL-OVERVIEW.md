# TransityTerminal — Production Readiness Deep Analysis

**Tanggal:** 24 April 2026
**Branch dianalisis:** `feat/reservation-engine-adapter` (HEAD `d42fb86`)
**Fokus:** TransityTerminal (workspace ini) + Reservation Engine sidecar (TransityTerminal_ResvCoreEngine)
**Ekosistem context:** TransityApp & TransityConsole hanya disinggung di titik integrasi

---

## 1. Lingkup yang Berubah Sejak Analisis Awal

| # | Penambahan/Perubahan | Dampak Arsitektur |
|---|---|---|
| 1 | **Rust Reservation Engine sidecar** (separate repo) | Optional opt-in via `RESERVATION_ENGINE_ENABLED` flag; menggantikan local hold service untuk operator high-volume |
| 2 | **Durable compensation queue** (migration `0009_engine_compensation_queue.sql`) | Mengatasi kegagalan partial antara DB lokal & engine |
| 3 | **Holds adapter pattern** (`server/modules/holds/holdsAdapter.ts`) | Strangler-fig dispatch antara legacy `AtomicHoldService` & engine |
| 4 | **Multi-promo system** (`booking_promo_applications` table, `promotion_conditions` JSON) | Stacking, auto-apply, voucher-on-top |
| 5 | **Strike pricing** | `PaymentPanel` render harga asli vs diskon |
| 6 | **Sales channel tracking** | Bookings simpan `sales_channel_code/name`, breakdown report per OTA partner |
| 7 | **Migration 0008** | Fix enum spelling + OTA payment field |
| 8 | **Reschedule via engine** | `reschedule.service.ts` route through engine + compensation queue |

---

## 2. Arsitektur TransityTerminal Saat Ini

```
┌─────────────────────────────────────────────────────────────────────┐
│                  TransityTerminal (per operator)                    │
│                                                                     │
│  ┌──────────────────────────┐   ┌────────────────────────────────┐ │
│  │  Node.js / Fastify 5     │   │  Rust Reservation Engine       │ │
│  │  - 32 service modules    │◀─▶│  - HTTP :8000 (HMAC-signed)    │ │
│  │  - Drizzle ORM           │   │  - In-memory Moka idempotency  │ │
│  │  - Socket.IO + Redis opt │   │  - axum + sqlx                 │ │
│  │  - Realmio auth (staff)  │   │  - Same Postgres DB (shared)   │ │
│  │  - JWT 24h (mobile)      │   │  - 60s reaper (advisory lock)  │ │
│  │  - Scheduler (advisory   │   │  - FOR UPDATE locks (ORDER BY  │ │
│  │    lock multi-instance)  │   │    leg_index for deadlock      │ │
│  │  - Compensation queue    │   │    prevention)                 │ │
│  │    consumer              │   │                                │ │
│  └──────────────┬───────────┘   └────────────────┬───────────────┘ │
│                 │                                 │                 │
│                 └─────────────┬───────────────────┘                 │
│                               ▼                                     │
│                 ┌──────────────────────────────────┐                │
│                 │  PostgreSQL (Neon or self-host)  │                │
│                 │  - 30+ tabel domain              │                │
│                 │  - 76+ indexes (post-hardening)  │                │
│                 │  - engine_compensation_queue     │                │
│                 │  - seat_inventory + seat_holds   │                │
│                 └──────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
                               ▲
                               │ HTTPS (X-Service-Key) + HMAC webhook
                               │
                  ┌────────────┴────────────┐
                  │  TransityConsole         │
                  │  Gateway                 │
                  └────────────┬────────────┘
                               │
                               ▼
                       TransityApp (B2C)
```

### 2.1. Backend Modules (32 modules di `server/modules/`)

```
auth · app · customers · dashboard · bookings · cargo · cashier · console
drivers · finance · holds · layouts · maintenance · notifications · outlets
patternStops · payments · priceRules · pricing · printing · promos
rbac · refunds · reports · scheduler · seatInventory · settings · spj
stops · tripBases · tripLegs · tripPatterns · trips · tripStopTimes · vehicles
```

### 2.2. Frontend (`client/`)

- **30 pages**: CSO (workflow 7-step), Bookings, Cargo terminal, Cashier, Refunds, Reports, Masters, Admin
- **Stack**: React 18 + Vite + TanStack Query + Wouter + Shadcn UI + Tailwind
- **WS pattern**: rooms `trip:{id}`, `base:{id}`, `cso:{outletId}:{date}`
- **Mobile webview** (`/mobile`) — separate static asset

### 2.3. Database Schema (`shared/schema/`)

```
network        — outlets, stops, cities, service lines
fleet          — vehicles, drivers, layouts, maintenance
scheduling     — trip_bases, trip_patterns, trips, pattern_stops, trip_stop_times, trip_legs
booking        — bookings, passengers, seat_holds, seat_inventory, booking_promo_applications, payments
cargo          — cargo_shipments, cargo_types, cargo_rates
finance        — cashier_sessions, cost_templates, spj_cost_lines
operations     — refunds, reviews, notifications
auth           — users, app_users, customer_profiles, roles, permissions
settings       — outlet settings, system settings, holds TTL config
promo          — promotions, promotion_conditions (JSONB), vouchers
```

---

## 3. Reservation Engine Detail (Critical New Component)

### 3.1. API Surface

| Endpoint | Purpose | Idempotent |
|---|---|---|
| `POST /api/v1/holds` | Atomic seat hold (TTL short/long) | ✅ via `Idempotency-Key` |
| `DELETE /api/v1/holds/:ref` | Release hold | — |
| `POST /api/v1/holds/:ref/confirm` | Hold → booked, attach `booking_id` | ✅ |
| `POST /api/v1/cancel-seats` | Release booked seats (per-seat) | ✅ |
| `GET /api/v1/inventory/:tripId` | Real-time inventory snapshot | — |
| `GET /api/v1/healthz` | Liveness probe (no HMAC) | — |

### 3.2. Security Contract

- **HMAC-SHA256**: `X-Signature = HMAC(shared_secret, {ts}.{METHOD}.{path}.{sha256(body)})`
- **Constant-time verify**: `subtle::ct_eq` ✅
- **Replay window**: ±30s timestamp skew (env `HMAC_SKEW_SECS`)
- **Idempotency**: 24h window via in-memory Moka cache (lost on engine restart)
- **Body collision detection**: Same key + different body → `409 Conflict`

### 3.3. Atomicity Strategy

- Postgres row-level `FOR UPDATE` lock pada `seat_inventory`
- **Deterministic ordering**: `ORDER BY leg_index` cegah deadlock multi-leg
- Reaper task setiap 60s dengan `pg_try_advisory_lock` (multi-instance safe)
- Confirmed holds (`booking_id IS NOT NULL`) **tidak pernah** di-reap
- Audit retention: confirmed holds dipurge setelah 30 hari (configurable)

### 3.4. Strangler-Fig Rollout

Per dokumentasi engine `engine/docs/TRANSITY_TERMINAL_INTEGRATION.md`:

- **Phase 1**: Sidecar idle (engine deployed, `RESERVATION_ENGINE_ENABLED=false`)
- **Phase 2**: Cutover per operator via env restart
- **NO DUAL-WRITE / SHADOW MODE** (eksplisit dilarang karena shared-DB topology) — read-only post-write audit only

### 3.5. Compensation Queue

- **Tabel**: `engine_compensation_queue` (`migration 0009`)
- **Trigger**: ketika operasi engine gagal **setelah** TT DB commit (mis. cancel-seats timeout)
- **Consumer**: scheduler `LOCK_ENGINE_COMP` setiap 60s, batch 50 dengan `FOR UPDATE SKIP LOCKED`
- **Max retry**: 50 attempts dengan backoff
- **Producer locations**:
  - `holdsAdapter.ts:286` (compensateConfirms)
  - `bookings.service.ts:507` (releasePendingBooking)
  - `unseat.service.ts:97, 191`
  - `reschedule.service.ts:193, 219, 447, 474`

---

## 4. Status Hardening Sprint April 2026 — Verified

Berikut item dari `fix/2026-04-20-comprehensive-hardening.md`, di-verify ulang:

| ID | Item | Status Verifikasi | Catatan |
|---|---|---|---|
| P1 | 22 indexes baru (76 total) | ✅ Confirmed (terlihat di schema) | OK |
| B1 | Idempotency unique constraint + race-loss handler | ✅ Confirmed | `bookings.service.ts:237` referensi idempotency_key |
| B2 | Seat-confirm + hold ownership re-assert | ✅ Confirmed | `booking.helpers.ts:184-258` |
| B3 | WS emit di luar transaction | ✅ Confirmed | `tripBases.service.ts` |
| B4 | Cargo update atomic transactional | ✅ Confirmed | `cargo.service.ts:138-191` |
| B5 | RBAC SPJ read routes | ✅ Confirmed | `spj.routes.ts` |
| B7 | Per-route rate limit booking by-code | ✅ Confirmed | 30/min |
| B9 | Disable response body log production | ✅ Confirmed | `server/index.ts` |
| B10 | JWT TTL 24h | ✅ Confirmed | `app.auth.ts` |
| B11 | Global rate limit 300/min + Redis-aware | ✅ Confirmed | `server/index.ts:47-59` |
| P3 | Functional indexes for reports | ✅ Confirmed | |
| Scheduler advisory lock | ✅ Confirmed | `pg_try_advisory_lock`, ID 8240_00x |
| WS Redis adapter optional | ✅ Confirmed | `realtime/ws.ts:53-65` |
| Scheduler skip OTA channel cleanup | ⚠ **Re-verify** | Per `TERMINAL_FIXES_APPLIED.md` Fix #1; perlu test runtime |

---

## 5. Test Coverage Saat Ini

```
Test files: 1
- server/seed.test.ts

Coverage: ~0% pada modul kritis
```

**Penilaian**: Kritis — booking, hold, payment, cargo, refund, cashier, pricing, promo **tidak punya test**.

---

## 6. CI/CD

```
.github/workflows/   →  TIDAK ADA
```

Tidak ada GitHub Actions, tidak ada pre-commit hook (Husky), tidak ada lint config aktif (eslint config tidak terlihat sebagai gate).

---

## 7. Observability

| Aspek | Status | Catatan |
|---|---|---|
| Logging | Plain `console.log` + custom `log()` helper dengan redaction key | Pino tersedia di package.json tapi tidak dipakai konsisten |
| Error tracking | ❌ Tidak ada Sentry/Bugsnag | |
| Metrics | ❌ Tidak ada Prometheus `/metrics` | |
| Tracing | ❌ Tidak ada OpenTelemetry | |
| Health check | Basic `/api/health` | Tidak deep-check (DB, Redis, Realmio) |
| Status page | ❌ Tidak ada | |

---

## 8. Severity Klasifikasi (Calibrated)

### 🔴 CRITICAL — Block production launch
1. **Refund approval tidak release seat** — `refunds.service.ts:63` (Confirmed)
2. **Cashier session per-outlet bukan per-staff** — `cashier.service.ts:15` (Confirmed)
3. **0 test untuk critical paths** (booking, hold, payment, refund, cashier, pricing, cargo)

### 🟠 HIGH — Fix sebelum public launch (tidak block dev)
4. **Cargo waybill PII publik** — `cargo.controller.ts:41` (Confirmed)
5. **No CI/CD pipeline** (Confirmed)
6. **No Sentry / structured logging** (Confirmed)
7. **No helmet / security headers** (Confirmed — defense-in-depth)
8. **Drivers/Vehicles tidak cek RBAC di service layer** (Confirmed)
9. **Engine idempotency in-memory only** — lost on restart (Confirmed by docs)

### 🟡 MEDIUM — Address dalam wave 2
10. **Notifications table tanpa TTL/cleanup** — bloat unbounded (Confirmed)
11. Reports query pakai `sql.raw` dengan multi sub-query JOIN — slow di scale (Confirmed)
12. `puppeteer` di client `dependencies` — bundle risk (Confirmed)
13. DataTable tanpa virtualisasi (Confirmed)
14. WS subscribe tanpa permission check on room access (Confirmed)
15. Notifications spam protection tidak ada (Confirmed)
16. Customer NIK plaintext (Confirmed — Low for B2C, **High** kalau audit regulasi)
17. Migration auto-run on boot tanpa rollback (Confirmed)
18. WS reconnection manual setTimeout pattern (Confirmed)

### 🟢 LOW — Backlog
19. No code splitting / React.Suspense (Confirmed)
20. Currency input tanpa thousand separator (Confirmed)
21. DataTable z-index potential conflict (Confirmed)
22. Customer ↔ App user FK tidak ada (linkage manual via phone) (Confirmed)

---

## 9. Dokumen Pendukung

- `01-TERMINAL-SECURITY.md` — temuan keamanan detail per modul + engine
- `02-TERMINAL-BUGS-AND-CONTRACTS.md` — bug aktif + kontrak engine/Console
- `03-TERMINAL-PERFORMANCE.md` — N+1, indexes, scaling
- `04-TERMINAL-DEVOPS.md` — CI/CD, observability, testing roadmap
- `05-TERMINAL-ROADMAP.md` — sprint plan dengan estimasi
- `06-TERMINAL-GO-LIVE-GATE.md` — checklist hard-gate sebelum launch (RECOMMENDED daily reference)

---

## 10. Headlines untuk Stakeholder

> **TransityTerminal sudah punya fondasi engineering yang kuat** — sprint hardening April 2026 menutup banyak race condition, plus integrasi engine Rust opsional yang elegan. **Tapi** ada 3 issue CRITICAL yang harus di-fix sebelum live: (1) refund tidak melepas kursi, (2) sesi kasir tidak support multi-staff, (3) zero tests pada modul finansial. Estimasi 3 minggu fokus untuk go-live ready, dengan engine integration sudah siap untuk operator high-volume.
