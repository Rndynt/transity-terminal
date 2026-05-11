# Audit S2-02 — `POST /api/app/bookings/:id/cancel`

**Sprint**: 2 / S2-02
**Files**: `server/modules/app/app.controller.ts:cancelBooking` (handler),
`server/modules/app/app.service.ts:1565-1700` (`cancelBooking` impl).

## Ringkasan flow (pasca S2-02)

1. Validasi ownership (booking ditemukan, `appUserId` match jika user-call).
2. Validasi status awal: hanya `pending` atau `confirmed` yang dapat
   dibatalkan dari sisi customer.
3. **[BARU S2-02] Cancellable rules berdasarkan trip status**:
   - `trip.status = 'closed'` → reject dengan pesan "Trip sudah berangkat
     — gunakan menu refund". Customer harus melalui RefundsService.
   - `trip.status = 'cancelled'` → reject dengan pesan "Trip sudah
     dibatalkan operator — kompensasi otomatis".
4. Capture `wasConfirmed = (status === 'confirmed')` sebelum tx.
5. Buka tx:
   a. **[BARU S2-02] CAS guard** `UPDATE bookings SET status='cancelled'
      WHERE id=? AND status IN ('pending','confirmed')` + `RETURNING id`.
      Kalau 0 row → throw → tx rollback. Mencegah race/double-cancel.
   b. UPDATE `seat_inventory.booked=false, hold_ref=NULL`.
   c. DELETE `seat_holds` untuk (trip, seats, booking).
6. **[BARU S2-02] Engine compensation pasca-tx**:
   Kalau `wasConfirmed && isEngineEnabled()`, enqueue `cancelSeats` per
   seat ke `engine_compensation_queue`. Best-effort: kalau enqueue gagal
   (db hiccup), log error tapi cancel TT-side tetap commit.
7. Emit `inventoryUpdated` ke WebSocket.

## Findings & perbaikan

### F1 — [FIXED] Tidak ada cancellable rules berbasis trip status

**Sebelum**: `cancelBooking` hanya cek `booking.status` IN ('pending',
'confirmed'). Trip yang sudah berangkat (`status='closed'`) tetap bisa
di-cancel oleh customer dari App → seat di-release di TT, padahal
penumpang sudah berangkat / no-show. Akibat: laporan inkonsisten,
sales report kehilangan revenue, mungkin double-spend kursi pada trip
berikutnya kalau seat ledger sempat di-reuse.

**Sesudah**: pre-tx check trip.status. Closed → arahkan ke refund flow
(yang punya approval). Cancelled (operator level) → tolak dengan pesan
informatif.

**Acceptance roadmap "cancel post-departure ditolak"**: ✅

### F2 — [FIXED] Tidak ada CAS guard untuk double-cancel

**Sebelum**: `UPDATE bookings SET status='cancelled' WHERE id=?` selalu
sukses tanpa cek status awal. Race antara dua POST /cancel paralel
keduanya akan SUCCESS, tapi seat_inventory di-release dua kali (idempotent
karena set `booked=false` apapun nilainya), DAN refund flow yang
mungkin sudah jalan untuk one cancel akan double-process.

**Sesudah**: CAS `WHERE id=? AND status IN ('pending','confirmed')` +
RETURNING. Loser dapat error "Booking sudah dibatalkan". Idempotent
secara end-state (1 booking cancelled).

### F3 — [FIXED] Engine ledger leak saat cancel booking confirmed

**Sebelum**: untuk booking confirmed via Console/OTA flow yang sudah
panggil `holdsAdapter.confirmForBooking` (engine seat ledger
booked=true), `cancelBooking` di App hanya release seat di TT
(seat_inventory). Engine ledger tetap menahan kursi → ketika engine
flag aktif, kursi tidak available di engine seatmap. Leak permanent
sampai operator manual cleanup.

**Sesudah**: pasca-tx, kalau `wasConfirmed && isEngineEnabled()`,
enqueue `cancelSeats` per seat ke `engine_compensation_queue`. Scheduler
akan retry sampai engine sukses release. Kalau gagal terus → DLQ +
alert (S2-04). Best-effort: tidak gagalkan cancel TT-side.

### F4 — [PASS] Idempotensi end-state

CAS guard di F2 memastikan retry POST /cancel oleh klien tidak
mengakibatkan side-effect ganda. Klien yang kalah dapat 400
"sudah dibatalkan" dan re-fetch akan melihat status 'cancelled' →
treat as success.

### F5 — [INFO] Refund eligibility tidak handle di sini

Cancel & refund adalah dua concern terpisah:
- `cancelBooking` (App): customer-facing, void booking + release seat.
- `RefundsService.create` + `.approve` (Console): staff-side, refund
  uang.

Saat customer cancel **confirmed paid booking** dari App, sistem
sekarang TIDAK auto-create refund request. Customer harus claim refund
manual via support → operator buat refund di Console. Ini intentional
(refund needs approval workflow + bukti). Severity LOW — sesuai
business policy operator (T&C cancel tidak otomatis = refund).

**Future enhancement**: optional auto-create `refunds` row dengan
status='pending' dan reason='customer_cancel_app' supaya operator
langsung punya queue. Tidak diimplement di S2-02 — perlu UX decision.

### F6 — [INFO] Promo usage_count tidak di-decrement

Saat booking confirmed, usage_count promo & voucher di-increment. Saat
cancel, kita TIDAK decrement balik. Ini intentional — banyak promo
operator pakai semantic "redeemed" (sekali pakai, tidak balik) bukan
"reservation slot". Kalau perlu reverse, harus via RefundsService.approve
yang punya `voucher_status='used'` revert logic.

## Perubahan kode S2-02

`server/modules/app/app.service.ts`:
- Tambah pre-tx trip status check (line 1577-1585).
- Tambah CAS guard untuk bookings UPDATE (line 1598-1607).
- Reorder: CAS guard dulu, baru release seat — supaya kalau race
  losing, seat tidak ke-release dua kali.
- Tambah pasca-tx engine compensation enqueue (line 1632-1651).

## Test coverage S2-02

`tests/sprint2.test.ts > AppService.cancelBooking`:
1. Booking tidak ditemukan.
2. Ownership mismatch (anti-IDOR).
3. Status non-cancellable (sudah cancelled).
4. **Trip closed** (post-departure) → pesan refund.
5. **Trip cancelled operator** → pesan kompensasi otomatis.

Acceptance roadmap "eligible booking refund" tercover oleh F5 design
note + redirection ke RefundsService.

## Acceptance roadmap

> cancel post-departure ditolak; eligible booking refund

- [x] cancel post-departure ditolak: F1 + test "menolak post-departure".
- [x] eligible booking refund: F5 — flow tetap melalui RefundsService
      yang sudah ada audit S1-01.
