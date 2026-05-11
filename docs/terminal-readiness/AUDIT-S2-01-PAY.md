# Audit S2-01 — `POST /api/app/bookings/:id/pay`

**Sprint**: 2 / S2-01
**Files**: `server/modules/app/app.controller.ts:398-414` (handler),
`server/modules/app/app.service.ts:1670-1896` (`payBooking` impl).

## Ringkasan flow

1. Validasi body (`paymentMethod`, optional `voucherCode`).
2. Load booking via `storage.getBookingById`. Ownership: kalau request
   bukan service-client, harus milik `appUserId` yang sama.
3. Guard pra-tx: status harus `pending`, `pendingExpiresAt` belum lewat,
   dan masih ada row aktif di `seat_holds` untuk booking ini.
4. Hitung discount stacking-aware (manual voucher overrides existing
   auto-promo applications, jika tidak preserve existing applications).
5. Buka `db.transaction(...)`:
   a. `SELECT FOR UPDATE` semua row `seat_inventory` untuk (trip, seats,
      legs). Kalau ada `booked=true` → throw, tx rollback.
   b. INSERT `payments` row status='success' dengan provider_ref
      `PAY-<random32hex>`.
   c. UPDATE `bookings SET status='confirmed' WHERE id=? AND status='pending'`.
      Status guard: kalau row tidak update (sudah confirmed/cancelled
      oleh path lain seperti webhook), throw → rollback seluruh tx
      termasuk INSERT payments.
   d. UPDATE `seat_inventory.booked=true, hold_ref=NULL`.
   e. DELETE `seat_holds` untuk (trip, seats).
   f. Untuk tiap promo application: UPDATE `promotions SET usage_count+=1`
      dengan WHERE clause yang validate `is_active` + `usage_count <
      usage_limit`. Voucher di-mark `status='used'` dengan WHERE status='active'.
6. Pasca tx: emit `inventoryUpdated` per seat ke WebSocket.

## Findings

### F1 — [PASS] Status guard mencegah double-confirm

`UPDATE bookings ... WHERE status='pending'` adalah CAS atomic Postgres.
Race antara `payBooking` & `processPaymentWebhook` (atau dua call
`payBooking` paralel) hanya akan ada SATU pemenang. Tx loser melempar
"Booking sudah dikonfirmasi atau dibatalkan" → INSERT payments
ikut rollback → tidak ada orphan payment row.

**Verifikasi**: lihat `tests/sprint2.test.ts > payBooking guards > "race
loser tidak menyisakan payment row"`.

### F2 — [PASS] Promo usage_count tidak double-increment

Update promotions di line 1853-1860 menggunakan WHERE
`(usage_limit IS NULL OR usage_count < usage_limit)`. Kalau race terjadi
saat usage_count sudah mencapai limit, update return 0 row → throw →
rollback seluruh tx. Voucher di-mark used hanya kalau masih `active`.

**Verifikasi**: `tests/sprint2.test.ts > payBooking guards > "promo
usage limit terhormat"`.

### F3 — [PASS] FOR UPDATE row lock pada seat_inventory

Line 1781-1787 menggunakan `SELECT ... FOR UPDATE`. Dua tx paralel akan
serial, dan pemenang kedua melihat row `booked=true` dari pemenang
pertama → throw. Mencegah double-booking di level tabel.

### F4 — [PASS] Hold expiry checked twice (pre-tx + dalam tx via FOR UPDATE)

- Pre-tx (line 1688-1696): cepat fail kalau `pendingExpiresAt` sudah
  lewat atau `seat_holds` kosong.
- In-tx: FOR UPDATE menangkap kasus race antara pre-tx check dan
  pembayaran (mis. reaper menghapus hold di antaranya).

### F5 — [LOW] HTTP-level idempotency tidak disediakan (tidak fatal)

Tidak ada header `Idempotency-Key`. Client retry POST /pay (network
blip) sebabkan 2 HTTP request server. Skenario:
- Request A masuk, mulai tx, INSERT payment, UPDATE booking
  pending→confirmed, COMMIT. Return 200.
- Request B masuk paralel. Sebelum A commit, B juga insert payment +
  UPDATE; B kalah di status guard atau seat_inventory FOR UPDATE → throw.
  Return 400.

Hasil end-state: 1 payment row, 1 booking confirmed, klien dapat 200
+ 400. Klien biasanya re-fetch state → tahu booking sudah confirmed
→ continue. Tidak ada efek finansial (no double-charge). Severity LOW.

**Mitigasi optional**: menambahkan header `Idempotency-Key` yang
di-cache 24 jam di tabel `payment_idempotency_keys` akan return 200
identik untuk retry. **Tidak diimplement di sprint ini** — biaya
rework klien (App + Web + OTA) tidak sebanding dengan severity.

### F6 — [INFO] Engine confirm tidak di-call di pay path

App flow (createAppBooking → pay) menggunakan TT-side `seat_holds`
saja, BUKAN engine. Engine confirm dipanggil hanya dari Console (CSO)
& reschedule path. Ini intentional (lihat
`server/modules/holds/holdsAdapter.ts:160-194`) — adopsi engine bertahap.

Konsekuensi: pay path tidak butuh compensation queue. Tidak ada gap.

## Test coverage baru (S2-01)

`tests/sprint2.test.ts` menambah:

1. **happy path**: pending → confirmed, payment row tercipta, status guard pass.
2. **race loser**: kalau update bookings return 0 row, payment INSERT ikut rollback (verify via tx mock).
3. **expired hold (pre-tx)**: throw "Booking hold has expired".
4. **expired hold (in-tx, no active row)**: throw "Seat holds have expired. Booking cannot be paid.".
5. **promo usage limit habis**: throw "Promo sudah tidak tersedia atau kuota habis".
6. **voucher sudah dipakai**: throw "Voucher sudah digunakan".

## Acceptance roadmap

> double-pay → 1 invoice; engine fail → reverted

- [x] **double-pay → 1 invoice**: covered by F1 (status guard) + F3
      (FOR UPDATE) + test "race loser tidak menyisakan payment row".
- [n/a] **engine fail → reverted**: pay path tidak panggil engine (F6).
       Untuk Console flow yang panggil engine, compensation sudah
       handled di `holdsAdapter.confirmForBooking` (line 230-256).
