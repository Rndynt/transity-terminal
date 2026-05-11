# AUDIT S2-11 — 10 Integration Tests (booking / cancel / webhook / cargo / refund)

**Sprint 2 / Item 11** — Roadmap acceptance: *10/10 pass via vitest*.
**Status:** ✅ DONE — `tests/sprint2-integration.test.ts` 10/10 PASS.
**Total Sprint 2 regression:** 37/37 PASS (sprint2 17 + ws 8 + chaos 4 +
integration 10) [setelah CR-S2-07 HIGH fix tambah 2 test ws].

## Skenario

| # | Nama | Modul | Yang diuji |
|---|------|-------|-----------|
| I1 | `payBooking` happy-path (engine off) | app.service.payBooking | guard hold/expired/pending lewat → masuk transaction body |
| I2 | `payBooking` double-call (status=confirmed) | app.service.payBooking | tolak dengan pesan "pending" |
| I3 | `payBooking` expired hold | app.service.payBooking | tolak dengan pesan "expired" |
| I4 | `cancelBooking` pending (sebelum bayar) | app.service.cancelBooking | CAS update lewat, tidak throw post-departure |
| I5 | `cancelBooking` confirmed + trip scheduled | app.service.cancelBooking | tidak throw post-departure / tidak tolak compensation |
| I6 | `cancelBooking` already cancelled (idempotent guard) | app.service.cancelBooking | throw "cannot be canceled" via getBookingById |
| I7 | `processPaymentWebhook` providerRef tidak ada | app.service.processPaymentWebhook | throw not-found |
| I8 | `processPaymentWebhook` replay event success | app.service.processPaymentWebhook | return `{ idempotent: true }` (regression untuk S2-09) |
| I9 | `CargoService.calculateTariff` math | cargo.service | `weight*ppk + leg*ppl` di-cap ke min charge; tanpa tripId → `legCount=1` |
| I10 | `RefundsService.create + reject` | refunds.service | record refund + mark `status='rejected'` |

## Mock pattern

Sama dengan `tests/sprint2.test.ts`:

- `@server/db` — chainable (`select.from.where.limit`, `insert.values.returning`,
  `update.set.where.returning`, `transaction(cb)` jalan callback dengan `tx`
  identik).
- `@server/storage` — method-mock per call-site; spec method baru muncul
  saat tes butuh (`findCargoRate`, `getTripStopTimes`, dst).
- `@server/realtime/ws` — stubbed (no socket boot).
- `@modules/holds/holdsAdapter` — `isEngineEnabled = false` supaya jalur
  legacy yg sedang diuji.
- `@modules/holds/compensationQueue` — partial mock via
  `vi.importActual` supaya struktur asli tetap dipakai.
- `PromosService` — stubbed (`validateAndCalculateDiscount` no-op).

## Acceptance check

- [x] 10/10 case PASS (`npx vitest run tests/sprint2-integration.test.ts`).
- [x] Tidak regress 27 test sprint2 lain (`npx vitest run tests/sprint2*.ts`
      → 37/37).
- [x] I8 mengunci kontrak idempotent dari S2-09 (replay tidak boleh
      throw).
- [x] I9 mengunci formula tariff cargo (regress test bila kontrak
      `findCargoRate` berubah).
- [x] I6 mengunci cancel-of-cancelled = error (bukan no-op silent).

## Catatan permissive-mocks (turunan code review S2-11)

Mock pakai chainable manual, jadi happy-path otomatis "sukses" terlepas
dari payload. Ini **diketahui** dan diterima untuk Sprint 2 karena:

1. Tes Sprint 2 fokus pada **branching logic & guards**, bukan SQL
   correctness — yang sudah ditangani oleh `npm run db:push` + verifikasi
   manual + chaos test (S2-03).
2. Switch ke `pg-mem`/test DB akan jadi item Sprint 3 atau 4 (catatan di
   roadmap follow-up).

## Referensi

- File: `tests/sprint2-integration.test.ts` (341 baris).
- Commit: `dc850d9` — `test(integration/S2-11): 10 integration tests
  booking/cancel/webhook/cargo/refund`.
