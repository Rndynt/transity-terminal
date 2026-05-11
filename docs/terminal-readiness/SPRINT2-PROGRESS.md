# Sprint 2 — INTEGRATION & ENGINE STABILITY — Progress Tracker

Branch: `feat/reservation-engine-adapter`
Started: 2026-04-24
Completed: 2026-04-24

| ID | Item | Severity | Status | Commit |
|---|---|---|---|---|
| S2-04 | Compensation queue DLQ + Sentry alert | 🟠 | ✅ DONE | `d2a8df1` |
| S2-05 | Engine HMAC skew 60s + clock health | 🟡 | ✅ DONE | `0aa2776` (digabung S2-06) |
| S2-06 | Engine `/healthz` integration → `/api/health/deep` | 🟡 | ✅ DONE | `0aa2776` |
| S2-08 | Notifications cleanup scheduler TTL 90 hari | 🟡 | ✅ DONE | `aac9735` |
| S2-10 | Engine activation runbook + smoke-test script | 🟡 | ✅ DONE | `5ce330c` |
| S2-01 | Audit `/api/app/bookings/:id/pay` + E2E | 🟡 | ✅ DONE | `c62c906` |
| S2-02 | Audit `/api/app/bookings/:id/cancel` + E2E | 🟡 | ✅ DONE | `6af72be` |
| S2-09 | Webhook idempotency + HMAC constant-time | 🟠 | ✅ DONE | `6693f5c` |
| S2-07 | WS room subscribe permission check | 🟡 | ✅ DONE | `09b044d` (+ CR-HIGH fix `c162c9f`) |
| S2-03 | Reschedule chaos test + alerting | 🟡 | ✅ DONE | `44818d8` |
| S2-11 | 10 integration tests booking/cancel/webhook/cargo/refund | — | ✅ DONE | `dc850d9` (+ audit doc `c162c9f`) |

## Catatan eksekusi

Urutan dipilih: items "kuasi-trivial" dulu (S2-04 DLQ, S2-05/06 health,
S2-08 scheduler, S2-10 runbook) → audit & guard work (S2-01/02/09) →
auth-sensitive (S2-07) → chaos test paling rumit (S2-03) → integration
suite (S2-11) terakhir untuk regression umbrella.

Setiap item satu commit terpisah dengan footer alasan supaya bisa
di-review/rollback per item.

## Mid-task code review (architect)

Code review dijalankan setelah S2-11 selesai dengan
`includeGitDiff: true`. Verdict awal: 1 HIGH + 2 MEDIUM finding.

| Severity | Issue | Fix |
|---|---|---|
| HIGH | WS handshake silent-downgrade saat klien kirim `serviceKey` tapi server tanpa `TERMINAL_SERVICE_KEY` | Reject eksplisit + console.error (`server/realtime/ws.ts`) — commit `c162c9f` |
| MEDIUM | `STRICT_WS_AUTH` default OFF | Diubah: default ON di production (`NODE_ENV=production`), OFF di dev — commit `c162c9f` |
| MEDIUM | Webhook idempotent return shape | Diterima as-is (kontrak `WebhookResult.idempotent?: boolean` sudah eksplisit) — lihat AUDIT-S2-09 |
| LOW | Race reschedule split (pre-existing) | Catat sebagai follow-up tech debt |
| LOW | Mock permissive di integration test | Catat sebagai follow-up test gaps |

## Test status final

```
npx vitest run tests/sprint2.test.ts tests/sprint2-ws.test.ts \
              tests/sprint2-reschedule-chaos.test.ts tests/sprint2-integration.test.ts

✓ tests/sprint2.test.ts                    (15 tests)
✓ tests/sprint2-ws.test.ts                 ( 8 tests)  ← +2 dari CR-HIGH fix
✓ tests/sprint2-reschedule-chaos.test.ts   ( 4 tests)
✓ tests/sprint2-integration.test.ts        (10 tests)

Test Files  4 passed (4)
     Tests  37 passed (37)
```

## Boot validation

```
GET /api/health/clock        → 200 {"status":"ok","serverTime":...,"hmacSkewSec":60}
GET /api/health/deep         → 401 {"error":"Missing X-Service-Key header"}    # gated, expected
GET /api/health/deep + key   → 200 {"status":"ok","checks":{"db":...,"engine":"skip","compensationQueue":...}}
```

Boot guard, helmet, CORS, WS handshake auth (production strict) semua
aktif. Engine compensation queue DLQ visible di health surface.

## Audit docs

- `AUDIT-S2-01-PAY.md`
- `AUDIT-S2-02-CANCEL.md`
- `AUDIT-S2-03-RESCHEDULE-CHAOS.md`
- `AUDIT-S2-07-WS-AUTH.md`
- `AUDIT-S2-09-WEBHOOK.md`
- `AUDIT-S2-11-INTEGRATION.md`
- `RUNBOOK-ENGINE-ACTIVATION.md`

## Exit gates

| Gate | Status | Bukti |
|---|---|---|
| GL-05 Console mock client idempotent retry safe | ✅ | AUDIT-S2-09 + I7/I8 integration |
| GL-06 Reschedule chaos: kill engine, no seat lost | ✅ | AUDIT-S2-03 + 4 test |
| GL-07 WS unauthorized room subscribe rejected | ✅ | tests/sprint2-ws.test.ts (STRICT_WS_AUTH=1 path) |
| GL-08 Notifications cleanup active (<1000/day budget) | ✅ | scheduler aktif tiap 360 menit (S2-08) |
| GL-09 Engine smoke test green for 100 cycles | ⏳ | script tersedia (`scripts/engine-smoke-test.sh`), belum dijalankan 100×; jadi item Sprint 5 soak |
