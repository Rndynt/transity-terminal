-- Sprint 1 / S1-06: tambah `tracking_secret` ke cargo_shipments supaya
-- public tracking endpoint tidak bisa di-enumerate dengan menebak waybill.
--
-- Backfill: semua shipment existing dapat secret random 16-char hex.
-- Setelah backfill kolom dijadikan NOT NULL.

ALTER TABLE cargo_shipments
  ADD COLUMN IF NOT EXISTS tracking_secret text;

UPDATE cargo_shipments
   SET tracking_secret = encode(gen_random_bytes(8), 'hex')
 WHERE tracking_secret IS NULL;

ALTER TABLE cargo_shipments
  ALTER COLUMN tracking_secret SET NOT NULL;

-- Index supaya lookup (waybill, secret) cepat (waybill_number sudah unique).
CREATE INDEX IF NOT EXISTS idx_cargo_tracking_secret
  ON cargo_shipments (tracking_secret);
