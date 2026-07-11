-- OD-matrix pricing for PASSENGERS. Solves the gap where price_rules
-- (flat | per_leg) cannot express independent prices per origin-destination
-- pair on a 3+ city pattern (e.g. JKT-BDG 95k, BDG-JOG 100k, JKT-JOG 200k).
-- Applied via `npm run db:push` (this repo's primary schema-sync workflow);
-- kept here as the audit-trail record of the change per project convention.

DO $$ BEGIN
  CREATE TYPE "passenger_matrix_scope" AS ENUM ('global', 'pattern');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "passenger_matrix_kind" AS ENUM ('regular', 'seasonal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "passenger_price_matrices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope" "passenger_matrix_scope" NOT NULL,
  "pattern_id" uuid REFERENCES "trip_patterns"("id"),
  "matrix" jsonb NOT NULL DEFAULT '{"version":1,"cells":{}}'::jsonb,
  "kind" "passenger_matrix_kind" NOT NULL DEFAULT 'regular',
  "name" text,
  "valid_from" timestamptz,
  "valid_to" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_passenger_matrix_scope_pattern_kind_window"
  ON "passenger_price_matrices" ("scope", "pattern_id", "kind", "valid_from", "valid_to")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_passenger_matrix_pattern_id" ON "passenger_price_matrices" ("pattern_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "passenger_price_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id" uuid NOT NULL REFERENCES "trips"("id"),
  "origin_stop_id" uuid NOT NULL,
  "destination_stop_id" uuid NOT NULL,
  "price" numeric(12,2) NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_passenger_price_exception_trip_od"
  ON "passenger_price_exceptions" ("trip_id", "origin_stop_id", "destination_stop_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_passenger_price_exception_trip_id" ON "passenger_price_exceptions" ("trip_id");
