-- =============================================================================
-- Migration 0001: Tambah semua kolom yang hilang dari migration awal
-- Menggunakan ADD COLUMN IF NOT EXISTS agar aman dijalankan berulang kali.
--
-- Konteks: Migration 0000 hanya membuat schema dasar. Kode sudah berkembang
-- jauh lebih maju dari migration-nya. Migration ini menyamakan keduanya.
-- Urutan: tabel baru dulu (customers, vouchers), lalu kolom tambahan.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tabel customers (baru — belum ada di migration 0000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "customers" (
	"id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name"     text NOT NULL,
	"email"         text NOT NULL,
	"phone"         text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url"    text,
	"is_verified"   text DEFAULT 'false' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at"    timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at"    timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint


-- -----------------------------------------------------------------------------
-- 2. Tabel vouchers (baru — belum ada di migration 0000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "vouchers" (
	"id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code"           text NOT NULL,
	"discount_type"  text NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"min_purchase"   numeric(12, 2),
	"max_discount"   numeric(12, 2),
	"valid_from"     timestamp with time zone NOT NULL,
	"valid_until"    timestamp with time zone NOT NULL,
	"usage_limit"    integer,
	"used_count"     integer DEFAULT 0 NOT NULL,
	"operator_id"    uuid,
	"active"         boolean DEFAULT true NOT NULL,
	"created_at"     timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint


-- -----------------------------------------------------------------------------
-- 3. operators — tambah webhook_secret
-- -----------------------------------------------------------------------------
ALTER TABLE "operators"
	ADD COLUMN IF NOT EXISTS "webhook_secret" text;
--> statement-breakpoint


-- -----------------------------------------------------------------------------
-- 4. bookings — tambah semua kolom yang hilang
--    Dikelompokkan per blok fungsional agar mudah dibaca
-- -----------------------------------------------------------------------------

-- [A] Relasi
ALTER TABLE "bookings"
	ADD COLUMN IF NOT EXISTS "customer_id"        uuid,
	ADD COLUMN IF NOT EXISTS "external_booking_id"  text,
	ADD COLUMN IF NOT EXISTS "booking_code"          text,
	ADD COLUMN IF NOT EXISTS "idempotency_key"       text;
--> statement-breakpoint

-- [B] Trip snapshot
ALTER TABLE "bookings"
	ADD COLUMN IF NOT EXISTS "service_date"         date,
	ADD COLUMN IF NOT EXISTS "origin_stop_id"       text,
	ADD COLUMN IF NOT EXISTS "origin_name"          text,
	ADD COLUMN IF NOT EXISTS "origin_city"          text,
	ADD COLUMN IF NOT EXISTS "depart_at"            text,
	ADD COLUMN IF NOT EXISTS "destination_stop_id"  text,
	ADD COLUMN IF NOT EXISTS "destination_name"     text,
	ADD COLUMN IF NOT EXISTS "destination_city"     text,
	ADD COLUMN IF NOT EXISTS "arrive_at"            text,
	ADD COLUMN IF NOT EXISTS "pattern_name"         text;
--> statement-breakpoint

-- [C] Penumpang
ALTER TABLE "bookings"
	ADD COLUMN IF NOT EXISTS "passengers_json" text;
--> statement-breakpoint

-- [D] Keuangan
ALTER TABLE "bookings"
	ADD COLUMN IF NOT EXISTS "fare_per_person"   numeric(12, 2),
	ADD COLUMN IF NOT EXISTS "discount_amount"   numeric(12, 2),
	ADD COLUMN IF NOT EXISTS "final_amount"      numeric(12, 2),
	ADD COLUMN IF NOT EXISTS "voucher_code"      text;
--> statement-breakpoint

-- [E] Payment flow
ALTER TABLE "bookings"
	ADD COLUMN IF NOT EXISTS "provider_ref"              text,
	ADD COLUMN IF NOT EXISTS "hold_expires_at"           timestamp with time zone,
	ADD COLUMN IF NOT EXISTS "payment_method"            text,
	ADD COLUMN IF NOT EXISTS "terminal_notified"         boolean DEFAULT false NOT NULL,
	ADD COLUMN IF NOT EXISTS "terminal_notify_failed_at" timestamp with time zone;
--> statement-breakpoint


-- -----------------------------------------------------------------------------
-- 5. Index untuk performa query umum
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_bookings_operator_id"
	ON "bookings" ("operator_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_bookings_customer_id"
	ON "bookings" ("customer_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_bookings_status"
	ON "bookings" ("status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_bookings_departure_date"
	ON "bookings" ("departure_date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_bookings_service_date"
	ON "bookings" ("service_date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_terminal_health_operator_checked"
	ON "terminal_health" ("operator_id", "checked_at" DESC);
--> statement-breakpoint

-- Partial index untuk reconciler — cari pending yang holdnya expired
CREATE INDEX IF NOT EXISTS "idx_bookings_pending_hold_expires"
	ON "bookings" ("hold_expires_at")
	WHERE "status" = 'pending';
--> statement-breakpoint

-- Partial index untuk idempotency
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bookings_idempotency_key"
	ON "bookings" ("idempotency_key")
	WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint

-- Partial index untuk provider_ref lookup (webhook)
CREATE INDEX IF NOT EXISTS "idx_bookings_provider_ref"
	ON "bookings" ("provider_ref")
	WHERE "provider_ref" IS NOT NULL;
--> statement-breakpoint

-- Partial index untuk terminal notification retry
CREATE INDEX IF NOT EXISTS "idx_bookings_terminal_not_notified"
	ON "bookings" ("id")
	WHERE "status" = 'confirmed' AND "terminal_notified" = false;
--> statement-breakpoint

-- Index untuk voucher lookup
CREATE INDEX IF NOT EXISTS "idx_vouchers_code"
	ON "vouchers" ("code");
