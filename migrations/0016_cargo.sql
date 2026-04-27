CREATE TABLE "cargo_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cargo_type_id" uuid NOT NULL,
	"scope" "cargo_rate_scope" DEFAULT 'global' NOT NULL,
	"scope_ref_id" uuid,
	"origin_stop_id" uuid,
	"destination_stop_id" uuid,
	"is_active" boolean DEFAULT true,
	"price_per_kg" numeric(12, 2) NOT NULL,
	"price_per_leg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"min_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
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
CREATE TABLE "cargo_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"description" text,
	"max_weight_kg" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cargo_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "cargo_rates" ADD CONSTRAINT "cargo_rates_cargo_type_id_cargo_types_id_fk" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_rates" ADD CONSTRAINT "cargo_rates_origin_stop_id_stops_id_fk" FOREIGN KEY ("origin_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_rates" ADD CONSTRAINT "cargo_rates_destination_stop_id_stops_id_fk" FOREIGN KEY ("destination_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_origin_stop_id_stops_id_fk" FOREIGN KEY ("origin_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_destination_stop_id_stops_id_fk" FOREIGN KEY ("destination_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_shipments" ADD CONSTRAINT "cargo_shipments_cargo_type_id_cargo_types_id_fk" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_rates_lookup ON "cargo_rates" (cargo_type_id, scope, scope_ref_id, is_active);
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
CREATE INDEX IF NOT EXISTS idx_cargo_outlet_created ON "cargo_shipments" (outlet_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_cargo_type_id ON "cargo_shipments" (cargo_type_id) WHERE cargo_type_id IS NOT NULL;
