CREATE TABLE "trip_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"leg_index" integer NOT NULL,
	"from_stop_id" uuid NOT NULL,
	"to_stop_id" uuid NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trip_stop_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"stop_sequence" integer NOT NULL,
	"arrive_at" timestamp with time zone,
	"depart_at" timestamp with time zone,
	"boarding_allowed" boolean,
	"alighting_allowed" boolean,
	"dwell_seconds" integer DEFAULT 0,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid,
	"pattern_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"status" "trip_status" DEFAULT 'scheduled',
	"vehicle_id" uuid NOT NULL,
	"layout_id" uuid,
	"capacity" integer NOT NULL,
	"driver_id" uuid,
	"origin_depart_hhmm" text,
	"channel_flags" jsonb DEFAULT '{"CSO":true,"WEB":false,"APP":false,"OTA":false}',
	"manifest_first_printed_at" timestamp with time zone,
	"snap_route_name" text,
	"snap_route_code" text,
	"snap_driver_name" text,
	"snap_vehicle_plate" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_from_stop_id_stops_id_fk" FOREIGN KEY ("from_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_to_stop_id_stops_id_fk" FOREIGN KEY ("to_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_stop_times" ADD CONSTRAINT "trip_stop_times_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_stop_times" ADD CONSTRAINT "trip_stop_times_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_base_id_trip_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."trip_bases"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
