-- Tambah kolom allow_intra_city_booking di trip_patterns: menandai apakah
-- pattern mengizinkan reservasi antar-stop dalam kota yang sama. Default
-- false untuk kompatibilitas data lama (schema drift fix — kolom sudah ada
-- di shared/schema tapi belum pernah di-migrate-kan).
ALTER TABLE "trip_patterns" ADD COLUMN IF NOT EXISTS "allow_intra_city_booking" boolean NOT NULL DEFAULT false;
