CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"exception_date" date NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedule_stop_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"exception_date" date NOT NULL,
	"stop_id" uuid NOT NULL,
	"disable_boarding" boolean DEFAULT true NOT NULL,
	"disable_alighting" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trip_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"pattern_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"mon" boolean DEFAULT true NOT NULL,
	"tue" boolean DEFAULT true NOT NULL,
	"wed" boolean DEFAULT true NOT NULL,
	"thu" boolean DEFAULT true NOT NULL,
	"fri" boolean DEFAULT true NOT NULL,
	"sat" boolean DEFAULT true NOT NULL,
	"sun" boolean DEFAULT true NOT NULL,
	"default_layout_id" uuid,
	"default_vehicle_id" uuid,
	"default_driver_id" uuid,
	"capacity" integer,
	"channel_flags" jsonb DEFAULT '{"CSO":true,"WEB":false,"APP":false,"OTA":false}' NOT NULL,
	"default_stop_times" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "trip_bases_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_base_id_trip_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."trip_bases"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_stop_exceptions" ADD CONSTRAINT "schedule_stop_exceptions_base_id_trip_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."trip_bases"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "schedule_stop_exceptions" ADD CONSTRAINT "schedule_stop_exceptions_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_default_layout_id_layouts_id_fk" FOREIGN KEY ("default_layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_default_vehicle_id_vehicles_id_fk" FOREIGN KEY ("default_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_default_driver_id_drivers_id_fk" FOREIGN KEY ("default_driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_bases_active ON "trip_bases" (active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_bases_pattern ON "trip_bases" (pattern_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_bases_valid ON "trip_bases" (valid_from, valid_to);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_exception_base_date ON "schedule_exceptions" (base_id, exception_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_exception_date ON "schedule_exceptions" (exception_date);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_stop_exception_base_date_stop ON "schedule_stop_exceptions" (base_id, exception_date, stop_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stop_exception_date ON "schedule_stop_exceptions" (exception_date);
