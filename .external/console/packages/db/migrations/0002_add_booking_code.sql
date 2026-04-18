-- =============================================================================
-- Migration 0002: Tambah kolom booking_code ke tabel bookings
-- 
-- Konteks: booking_code (kode human-readable dari Terminal, misal BKG-X7K2M1)
-- ditambahkan ke schema SETELAH migration 0001 sudah dijalankan di production.
-- Migration ini memastikan kolom tersedia di DB yang sudah berjalan.
-- =============================================================================

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "booking_code" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_bookings_booking_code"
  ON "bookings" ("booking_code")
  WHERE "booking_code" IS NOT NULL;
