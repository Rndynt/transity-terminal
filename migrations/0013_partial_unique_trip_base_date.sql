-- Make uniq_trip_base_per_day partial on deleted_at IS NULL.
--
-- Background (P2 §4 follow-up of PR #12):
--
-- Staff penjadwalan punya flow yang sah untuk membatalkan trip tanggal
-- tertentu (armada rusak, tanggal merah, cuaca buruk) lewat
-- DELETE /api/trips/:id. Endpoint itu memanggil storage.deleteTrip yang
-- soft-delete — set status='cancelled' + deleted_at=now() dan membersihkan
-- seat_inventory / trip_stop_times / trip_legs untuk trip itu.
--
-- Masalahnya, index unique yang lama:
--
--   CREATE UNIQUE INDEX uniq_trip_base_per_day ON trips (base_id, service_date)
--   WHERE base_id IS NOT NULL
--
-- tidak mengecualikan row yang soft-deleted, sehingga slot (base, date)
-- tetap dipegang setelah admin hapus. Akibatnya user/CSO yang kemudian
-- mencoba membuka seatmap untuk (base, date) itu membuat
-- ensureMaterializedTrip mencoba createTrip → gagal 23505 → re-read via
-- getTripByBaseAndDate (yang di PR #12 sudah benar: filter deleted_at IS NULL)
-- → undefined → throw. Trip permanen tidak bisa dibuat ulang tanpa
-- intervensi manual di database.
--
-- Fix: tambah `AND deleted_at IS NULL` ke partial clause, sehingga
-- soft-deleted row tidak lagi memblokir re-insert. Audit trail tetap aman
-- (row lama tetap tersimpan dengan deleted_at terisi), dan admin yang
-- mau lihat laporan trip cancelled bisa query `WHERE deleted_at IS NOT NULL`.
--
-- DROP + CREATE dipisah karena Postgres tidak mendukung mengubah predicate
-- partial index secara in-place. Keduanya IF EXISTS / IF NOT EXISTS supaya
-- migration idempotent dan tidak crash kalau dijalankan di DB yang tracking
-- drizzle-nya out-of-sync (mirip pola di migrations lain di repo ini).

DROP INDEX IF EXISTS uniq_trip_base_per_day;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_trip_base_per_day
  ON trips (base_id, service_date)
  WHERE base_id IS NOT NULL AND deleted_at IS NULL;
