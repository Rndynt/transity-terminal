-- Backfill payments.status='success' for paid bookings whose payments
-- were left at default 'pending' due to the bug fixed in PR #10.
--
-- Background:
--   roundTrip.service.ts dan beberapa path lama insert ke `payments` tanpa
--   eksplisit set `status` → kena DEFAULT 'pending'. Padahal bookings
--   sudah `status='paid'` sehingga finance reports yang filter
--   `WHERE payments.status='success'` melewatkan revenue tersebut.
--   Bug di-fix struktural di PR #10 (semua insert path eksplisit set
--   status='success' + paidAt + providerRef saat pembayaran selesai).
--   Migration ini cleanup data historis pre-PR #10.
--
-- Strategi konservatif:
--   * Hanya update payment yang ber-belong ke booking dengan status
--     `paid` ATAU `confirmed`/`checked_in` (terminal-paid states).
--   * Hanya update payment yang masih `status='pending'` dan punya
--     `amount > 0`.
--   * `paidAt` di-set fallback ke `COALESCE(paidAt, bookings.created_at, now())`
--     supaya report yang join paidAt dapat tanggal yang masuk akal.
--   * `provider_ref` ditambahi tag `BACKFILL_0016` untuk audit trail.
--
-- Idempotent: re-run migration tidak akan double-update karena WHERE
-- clause hanya menyentuh row yang masih 'pending'.

UPDATE payments p
SET
  status = 'success',
  paid_at = COALESCE(p.paid_at, b.created_at, now()),
  provider_ref = CASE
    WHEN p.provider_ref IS NULL OR p.provider_ref = ''
      THEN 'BACKFILL_0016'
    ELSE p.provider_ref
  END
FROM bookings b
WHERE p.booking_id = b.id
  AND p.status = 'pending'
  AND p.amount::numeric > 0
  AND b.status IN ('paid', 'confirmed', 'checked_in');
