# Sprint 1 — STOP THE BLEED — Progress Tracker

Branch: `feat/reservation-engine-adapter`
Started: 2026-04-24
Completed: 2026-04-24

| ID | Item | Severity | Status | Commit |
|---|---|---|---|---|
| S1-05 | Fix `isProcessing` stuck di CSO page | 🟠 | ✅ DONE | `0f2feb5` |
| S1-04 | Fix voucher generation collision-safe | 🟠 | ✅ DONE | `290448d` |
| S1-01 | Fix refund approval seat release | 🔴 | ✅ DONE | `4d25f54` |
| S1-03 | Fix promo `usageCount` decrement on cancel/refund | 🟠 | ✅ DONE | `4d25f54` (digabung) |
| S1-08 | Install `@fastify/helmet` + consolidate CORS | 🟠 | ✅ DONE | `d3a74c2` |
| S1-07 | Production boot guard: fail-fast jika secrets hilang | 🟠 | ✅ DONE | `d3a74c2` (digabung) |
| S1-02 | Fix cashier session per-staff | 🔴 | ✅ DONE | `925e782` |
| S1-06 | Cargo waybill: add `tracking_secret` requirement | 🟠 | ✅ DONE | `e68098b` |
| S1-10 | Write 5 unit tests untuk S1-01 dan S1-02 | — | ✅ DONE | `398c256` |
| S1-09 | Move RBAC check ke service layer | 🟠 | ⏭️ DEFERRED | Sprint 2 |

## Catatan eksekusi

Urutan dipilih: quick wins dulu (momentum) → critical complex → schema-touching → multi-touch → tests.

Setiap item satu commit terpisah supaya bisa di-review/rollback per fix.

## Yang di-defer ke Sprint 2

### S1-09 — RBAC service-layer guards
Scope luas (5+ modul kritis: drivers, vehicles, schedules, fares, refunds), butuh
audit setiap callsite + refactor middleware contract. Risk merusak existing flows
tinggi. Lebih aman dipisah jadi epic Sprint 2 dengan RFC + test coverage.

### Cashier per-staff reconciliation accuracy
Migrasi 0010 + service refactor sudah membolehkan multiple staff buka sesi
paralel di outlet sama. Tapi `payments` belum punya kolom `cashier_session_id`,
jadi summary/close masih attribusi outlet-level di window waktu sesi. Untuk
attribusi 100% akurat per kasir butuh:

1. Migration: `ALTER TABLE payments ADD COLUMN cashier_session_id uuid REFERENCES cashier_sessions(id)`.
2. Stamping: di checkout/CSO route, resolve sesi aktif staff dan tulis ke
   `payments.cashier_session_id`.
3. Backfill: existing payments diattribusikan via window waktu (best-effort).
4. Reports: ganti `WHERE outlet_id + paid_at range` jadi `WHERE cashier_session_id`.

## Test status

```
npx vitest run tests/sprint1.test.ts
✓ tests/sprint1.test.ts (5 tests) — all passing
```

## Boot validation

```
curl -I http://localhost:5000/api/health
HTTP/1.1 401 Unauthorized                  # endpoint butuh service-key (expected)
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: cross-origin
Referrer-Policy: no-referrer
vary: Origin
access-control-allow-credentials: true
```

Helmet aktif, CORS unified, boot guard menolak misconfig di prod.
