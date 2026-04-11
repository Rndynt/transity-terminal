-- =============================================================================
-- Migration 0008: Fix enum spelling + add OTA payment support
-- 1. Rename 'canceled' → 'cancelled' di semua enum yang terdampak
-- 2. Tambah 'online' ke payment_method enum (untuk konfirmasi OTA dari Console)
-- 3. Update data existing yang pakai nilai lama
-- =============================================================================

-- Step 1: Rename 'canceled' → 'cancelled' di booking_status
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint

-- Update data existing
UPDATE bookings SET status = 'cancelled' WHERE status = 'canceled';
--> statement-breakpoint

UPDATE passengers SET ticket_status = 'cancelled' WHERE ticket_status = 'canceled';
--> statement-breakpoint

-- Step 2: Rename 'canceled' → 'cancelled' di ticket_status  
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint

-- Step 3: Rename 'canceled' → 'cancelled' di trip_status
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint

UPDATE trips SET status = 'cancelled' WHERE status = 'canceled';
--> statement-breakpoint

-- Step 4: Rename 'canceled' → 'cancelled' di cargo_status
ALTER TYPE cargo_status ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint

UPDATE cargo_shipments SET status = 'cancelled' WHERE status = 'canceled';
--> statement-breakpoint

-- Step 5: Rename 'canceled' → 'cancelled' di booking_history_action
ALTER TYPE booking_history_action ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint

UPDATE booking_history SET action = 'cancelled' WHERE action = 'canceled';
--> statement-breakpoint

-- Step 6: Tambah 'online' ke payment_method (untuk OTA payments dari Console)
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'online';
--> statement-breakpoint

-- Catatan: PostgreSQL tidak mendukung DROP VALUE dari enum.
-- Nilai lama ('canceled') dibiarkan ada di DB tapi tidak akan dipakai lagi di kode.
-- Data sudah di-update ke nilai baru ('cancelled') di step sebelumnya.
