-- Sprint 1 / S1-06: tambah `tracking_secret` ke cargo_shipments supaya
-- public tracking endpoint tidak bisa di-enumerate dengan menebak waybill.
--
-- Backfill: semua shipment existing dapat secret random 16-char hex.
-- Setelah backfill kolom dijadikan NOT NULL.

ALTER TABLE cargo_shipments
  ADD COLUMN IF NOT EXISTS tracking_secret text;

-- Backfill juga repair empty-string yang mungkin sudah ada dari schema
-- default '' (db:push lebih dulu daripada migration ini di beberapa env).
UPDATE cargo_shipments
   SET tracking_secret = encode(gen_random_bytes(8), 'hex')
 WHERE tracking_secret IS NULL
    OR btrim(tracking_secret) = '';

ALTER TABLE cargo_shipments
  ALTER COLUMN tracking_secret SET NOT NULL;
ALTER TABLE cargo_shipments
  ALTER COLUMN tracking_secret DROP DEFAULT;

-- Index supaya lookup (waybill, secret) cepat (waybill_number sudah unique).
CREATE INDEX IF NOT EXISTS idx_cargo_tracking_secret
  ON cargo_shipments (tracking_secret);
