-- Cargo OD-matrix pricing identity swap (mirrors migrations/0013_pricing.sql
-- for passenger price_rules). Full rewrite of this file, create-only — this
-- is a DEVELOPMENT codebase, no production data. `cargo_rates` KEEPS its
-- name but is now an OD-matrix table (pattern+cargoType scoped, jsonb
-- matrix), not the old flat/scope-chain shape. `cargo_rate_exceptions` is
-- new (per-trip overrides). `min_charge` moved onto `cargo_types`.
--
-- Dev DB reset (any environment that already has the OLD cargo_rates
-- shape): run
--   DROP TABLE IF EXISTS "cargo_rate_exceptions" CASCADE;
--   DROP TABLE IF EXISTS "cargo_rates" CASCADE;
-- then `npm run db:push` — see CARGO_OD_MATRIX_IMPLEMENTATION_REPORT.md.
--
-- NOTE (matches the precedent set for 0013_pricing.sql): this repo's actual
-- live-apply path for schema changes during development is
-- `npm run db:push` (drizzle-kit push, schema-diff against the live DB) —
-- it does not read this migrations folder or its meta/journal at all for
-- that workflow. This file exists purely as a `drizzle-kit generate`-style
-- historical record of the shape, so `migrations/meta/_journal.json` and
-- the numbered snapshot files were deliberately left untouched.
CREATE TABLE "cargo_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"description" text,
	"max_weight_kg" numeric(8, 2),
	"min_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cargo_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cargo_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cargo_type_id" uuid NOT NULL,
	"pattern_id" uuid NOT NULL,
	"matrix" jsonb DEFAULT '{"version":1,"cells":{}}'::jsonb NOT NULL,
	"kind" "cargo_rate_kind" DEFAULT 'regular' NOT NULL,
	"name" text,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cargo_rate_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"cargo_type_id" uuid NOT NULL,
	"origin_stop_id" uuid NOT NULL,
	"destination_stop_id" uuid NOT NULL,
	"price_per_kg" numeric(12, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cargo_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waybill_number" text NOT NULL,
	"status" "cargo_status" DEFAULT 'received',
	"trip_id" uuid NOT NULL,
	"origin_stop_id" uuid NOT NULL,
	"destination_stop_id" uuid NOT NULL,
	"outlet_id" uuid,
	"destination_outlet_id" uuid,
	"channel" "channel" DEFAULT 'CSO',
	"cargo_type_id" uuid,
	"sender_name" text NOT NULL,
	"sender_phone" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"item_description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"weight_kg" numeric(8, 2),
	"length_cm" numeric(8, 2),
	"width_cm" numeric(8, 2),
	"height_cm" numeric(8, 2),
	"declared_value" numeric(12, 2),
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method",
	"paid_at" timestamp with time zone,
	"notes" text,
	"tracking_secret" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cargo_shipments_waybill_number_unique" UNIQUE("waybill_number")
);
--> statement-breakpoint
ALTER TABLE "cargo_rates" ADD CONSTRAINT "cargo_rates_cargo_type_id_cargo_types_id_fk" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_rates" ADD CONSTRAINT "cargo_rates_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_rate_exceptions" ADD CONSTRAINT "cargo_rate_exceptions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_rate_exceptions" ADD CONSTRAINT "cargo_rate_exceptions_cargo_type_id_cargo_types_id_fk" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_origin_stop_id_stops_id_fk" FOREIGN KEY ("origin_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_destination_stop_id_stops_id_fk" FOREIGN KEY ("destination_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_destination_outlet_id_outlets_id_fk" FOREIGN KEY ("destination_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_cargo_type_id_cargo_types_id_fk" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cargo_rate_cargo_type_pattern_kind_window ON "cargo_rates" (cargo_type_id, pattern_id, kind, valid_from, valid_to) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_rates_pattern_cargo_type ON "cargo_rates" (pattern_id, cargo_type_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cargo_rate_exception_trip_cargo_type_od ON "cargo_rate_exceptions" (trip_id, cargo_type_id, origin_stop_id, destination_stop_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_rate_exception_trip_id ON "cargo_rate_exceptions" (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_trip_id ON "cargo_shipments" (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_status ON "cargo_shipments" (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_outlet_id ON "cargo_shipments" (outlet_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_trip_status ON "cargo_shipments" (trip_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_paid_at ON "cargo_shipments" (paid_at) WHERE paid_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_paid_date ON "cargo_shipments" ((paid_at::date)) WHERE paid_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_outlet_created ON "cargo_shipments" (outlet_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_cargo_type_id ON "cargo_shipments" (cargo_type_id) WHERE cargo_type_id IS NOT NULL;
