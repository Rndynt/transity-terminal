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
