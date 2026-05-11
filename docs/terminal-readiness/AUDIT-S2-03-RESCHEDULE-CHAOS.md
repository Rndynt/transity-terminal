# Audit S2-03 — Reschedule Chaos Test + Alerting

**Sprint**: 2 / S2-03
**Files**:
- `server/modules/bookings/reschedule.service.ts` (sudah dipasang
  compensation enqueue di Sprint sebelumnya — audit ini hanya
  verifikasi dengan chaos test).
- `tests/sprint2-reschedule-chaos.test.ts` (4 test chaos).

## Threat model

Reschedule punya 3 langkah engine yang bisa gagal independen:

1. `holdAndConfirmShort` → book seat baru di engine **sebelum** local tx.
2. `db.transaction` → update passengers/bookings/booking_history lokal.
3. `cancelSeats(old)` → free seat lama di engine **setelah** local tx
   commit.

Yang bahaya kalau salah satu fail tanpa mitigasi:

- Step 1 fail → caller dapat error, tidak ada side-effect (tx belum
  jalan, kursi lama masih punya pax).
- Step 1 OK + Step 2 fail → kursi baru sudah ter-book di engine, tapi
  state lokal tidak commit. Tanpa kompensasi → seat tertahan terus
  (silent inventory leak).
- Step 1+2 OK + Step 3 fail → reschedule **valid secara lokal** tapi
  engine masih punya kursi lama booked. Tanpa enqueue → kursi lama
  tertahan terus.

Pattern yang harus dibuktikan:
- Step 2 fail → adapter.cancelSeats(new) panggil **sekali**. Kalau
  call itu juga gagal → enqueue ke compensation queue (DLQ jaring).
- Step 3 fail → enqueue, tapi reschedule report success (jangan
  rollback kursi baru karena state lokal sudah benar).

## Implementation summary

`reschedule.service.ts:177-202` (single-pax) dan `:432-456`
(batch) sudah implement try/catch dengan compensation +
enqueueCancelSeats fallback. Pattern identik untuk Old-cancel di
:208-226 (single) dan :460-481 (batch).

Catatan: kompensasi pakai `await import('@modules/holds/compensationQueue')`
(dynamic) supaya menghindari circular import dengan holdsAdapter.

## Chaos test coverage (tests/sprint2-reschedule-chaos.test.ts)

| Case | Skenario                              | Expected                                                      | Actual           |
| ---  | ---                                   | ---                                                           | ---              |
| A    | holdAndConfirmShort fail pre-tx       | throw, no compensation, no enqueue                            | ✅ PASS          |
| B    | tx fail + cancelSeats(new) OK         | adapter.cancelSeats(new) sekali, no enqueue                   | ✅ PASS          |
| C    | tx fail + cancelSeats(new) JUGA fail  | enqueueCancelSeats({tripId:NEW, source:compensation})        | ✅ PASS          |
| D    | tx OK + cancelSeats(old) fail         | enqueueCancelSeats({tripId:OLD, source:cancelOld}); success  | ✅ PASS          |

## Alerting

Compensation enqueue saat ini **log structured warning** via
`console.error('[RESCHEDULE] ...')`. Sentry transport (Sprint 1) akan
pick-up otomatis. Selain itu, S2-04 sudah expose
`compensationQueue.getStuckCount()` yang dipanggil oleh
`/api/health/deep` (S2-06) — alert dashboard bisa monitor angka itu
(`cq_stuck_count > 0` → warn, `> 5` → page).

Tidak ada alert path baru yang ditambah di S2-03; kita hanya
membuktikan compensation fallback path benar-benar fire saat engine
chaos. Kombinasi:

- S2-03 chaos test (compensation fire saat engine fail).
- S2-04 DLQ + getStuckCount (dead-letter setelah max-retry).
- S2-06 /api/health/deep expose count (visibility ops).

= jaring lengkap untuk reschedule failure.

## Acceptance roadmap

> kill engine mid-flow; verify CQ queue + alert fires
> test PASS, CQ catch failure, alert log emitted

- [x] **kill engine mid-flow**: 4 chaos case (pre-tx, tx-fail, double-fail, post-tx-fail).
- [x] **CQ queue catch failure**: case C & D verify
      `enqueueCancelSeats` dipanggil dengan context yang benar.
- [x] **alert log emitted**: stderr menunjukkan
      `[RESCHEDULE] compensation cancelSeats(new) failed, enqueuing: ...`
      dan
      `[RESCHEDULE] engine cancelSeats(old) failed, enqueuing for retry: ...`
- [x] **test PASS**: 4/4 di vitest.
