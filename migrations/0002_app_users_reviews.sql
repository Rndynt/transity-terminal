-- Migration: Add app_users, reviews tables and appUserId to bookings
-- For Transity Mobile App (B2C marketplace)

CREATE TABLE IF NOT EXISTS "app_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "avatar" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "app_user_id" uuid NOT NULL REFERENCES "app_users"("id"),
  "trip_id" uuid NOT NULL REFERENCES "trips"("id"),
  "booking_id" uuid REFERENCES "bookings"("id"),
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "app_user_id" uuid REFERENCES "app_users"("id");
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_app_users_email" ON "app_users" ("email");
CREATE INDEX IF NOT EXISTS "idx_reviews_trip_id" ON "reviews" ("trip_id");
CREATE INDEX IF NOT EXISTS "idx_reviews_app_user_id" ON "reviews" ("app_user_id");
CREATE INDEX IF NOT EXISTS "idx_bookings_app_user_id" ON "bookings" ("app_user_id");

CREATE OR REPLACE VIEW "customer_bookings" AS
SELECT
  b.id,
  b.trip_id,
  b.origin_stop_id,
  b.destination_stop_id,
  b.origin_seq,
  b.destination_seq,
  b.status,
  b.total_amount,
  b.channel,
  b.app_user_id,
  b.created_at,
  t.service_date,
  tp.code AS pattern_code,
  tp.name AS pattern_name,
  tp.vehicle_class,
  os.name AS origin_name,
  os.city AS origin_city,
  ds.name AS destination_name,
  ds.city AS destination_city,
  au.name AS customer_name,
  au.email AS customer_email,
  au.phone AS customer_phone,
  (SELECT COUNT(*)::int FROM passengers p WHERE p.booking_id = b.id) AS passenger_count
FROM bookings b
INNER JOIN trips t ON t.id = b.trip_id
INNER JOIN trip_patterns tp ON tp.id = t.pattern_id
LEFT JOIN stops os ON os.id = b.origin_stop_id
LEFT JOIN stops ds ON ds.id = b.destination_stop_id
LEFT JOIN app_users au ON au.id = b.app_user_id
WHERE b.app_user_id IS NOT NULL;
