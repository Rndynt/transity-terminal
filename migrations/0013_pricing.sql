-- OD-matrix pricing for PASSENGERS. Table/enum names below are the
-- IDENTITY-SWAPPED `price_rules` system: the old flat/per_leg shape
-- (scope pattern|trip|leg|time, tripId/legIndex/priority/rule columns) is
-- gone. `price_rules` now means the OD-matrix shape (jsonb matrix keyed by
-- stopId pairs), matching shared/schema/pricing.ts. Create-only DDL, no
-- ALTER — this repo's live-apply path is `npm run db:push` (schema-diff),
-- this file is the audit-trail record of the shape per project convention.

DO $$ BEGIN
  CREATE TYPE "price_rule_scope" AS ENUM ('global', 'pattern');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "price_rule_kind" AS ENUM ('regular', 'seasonal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope" "price_rule_scope" NOT NULL,
  "pattern_id" uuid REFERENCES "trip_patterns"("id"),
  "matrix" jsonb NOT NULL DEFAULT '{"version":1,"cells":{}}'::jsonb,
  "kind" "price_rule_kind" NOT NULL DEFAULT 'regular',
  "name" text,
  "valid_from" timestamptz,
  "valid_to" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_price_rule_scope_pattern_kind_window"
  ON "price_rules" ("scope", "pattern_id", "kind", "valid_from", "valid_to")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_rules_pattern_id" ON "price_rules" ("pattern_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_rule_exceptions" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_price_rule_exception_trip_od"
  ON "price_rule_exceptions" ("trip_id", "origin_stop_id", "destination_stop_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_rule_exception_trip_id" ON "price_rule_exceptions" ("trip_id");
