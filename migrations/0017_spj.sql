CREATE TABLE "spj" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spj_number" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"status" "spj_status" DEFAULT 'draft',
	"issued_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "spj_spj_number_unique" UNIQUE("spj_number")
);
--> statement-breakpoint
CREATE TABLE "spj_cost_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spj_id" uuid NOT NULL,
	"category" "cost_item_category" NOT NULL,
	"label" text NOT NULL,
	"estimated_amount" numeric(12, 2) NOT NULL,
	"actual_amount" numeric(12, 2),
	"is_advance" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "spj" ADD CONSTRAINT "spj_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spj" ADD CONSTRAINT "spj_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spj" ADD CONSTRAINT "spj_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "spj_cost_lines" ADD CONSTRAINT "spj_cost_lines_spj_id_spj_id_fk" FOREIGN KEY ("spj_id") REFERENCES "public"."spj"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_spj_trip_id ON "spj" (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_spj_status ON "spj" (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_spj_driver_id ON "spj" (driver_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_spj_cost_lines_spj_id ON "spj_cost_lines" (spj_id);
