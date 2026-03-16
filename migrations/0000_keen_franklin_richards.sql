CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'checked_in', 'paid', 'canceled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('CSO', 'WEB', 'APP', 'OTA');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'qr', 'ewallet', 'bank');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."price_rule_scope" AS ENUM('pattern', 'trip', 'leg', 'time');--> statement-breakpoint
CREATE TYPE "public"."print_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('scheduled', 'canceled', 'closed');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"origin_stop_id" uuid NOT NULL,
	"destination_stop_id" uuid NOT NULL,
	"origin_seq" integer NOT NULL,
	"destination_seq" integer NOT NULL,
	"outlet_id" uuid,
	"channel" "channel" DEFAULT 'CSO',
	"status" "booking_status" DEFAULT 'pending',
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'IDR',
	"created_by" text,
	"pending_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rows" integer NOT NULL,
	"cols" integer NOT NULL,
	"seat_map" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"printer_profile_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "outlets_stop_id_unique" UNIQUE("stop_id")
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"id_number" text,
	"seat_no" text NOT NULL,
	"fare_amount" numeric(12, 2) NOT NULL,
	"fare_breakdown" jsonb
);
--> statement-breakpoint
CREATE TABLE "pattern_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"stop_sequence" integer NOT NULL,
	"dwell_seconds" integer DEFAULT 0,
	"boarding_allowed" boolean DEFAULT true NOT NULL,
	"alighting_allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'success',
	"provider_ref" text,
	"paid_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "price_rule_scope" NOT NULL,
	"pattern_id" uuid,
	"trip_id" uuid,
	"leg_index" integer,
	"rule" jsonb NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"priority" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"status" "print_status" DEFAULT 'queued',
	"attempts" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seat_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_ref" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"seat_no" text NOT NULL,
	"leg_indexes" integer[] NOT NULL,
	"ttl_class" text NOT NULL,
	"operator_id" text NOT NULL,
	"booking_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "seat_holds_hold_ref_unique" UNIQUE("hold_ref")
);
--> statement-breakpoint
CREATE TABLE "seat_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"seat_no" text NOT NULL,
	"leg_index" integer NOT NULL,
	"booked" boolean DEFAULT false,
	"hold_ref" text
);
--> statement-breakpoint
CREATE TABLE "stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"is_outlet" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stops_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "trip_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"mon" boolean DEFAULT true NOT NULL,
	"tue" boolean DEFAULT true NOT NULL,
	"wed" boolean DEFAULT true NOT NULL,
	"thu" boolean DEFAULT true NOT NULL,
	"fri" boolean DEFAULT true NOT NULL,
	"sat" boolean DEFAULT true NOT NULL,
	"sun" boolean DEFAULT true NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"default_layout_id" uuid,
	"default_vehicle_id" uuid,
	"capacity" integer,
	"channel_flags" jsonb DEFAULT '{"CSO":true,"WEB":false,"APP":false,"OTA":false}' NOT NULL,
	"default_stop_times" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trip_bases_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "trip_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"leg_index" integer NOT NULL,
	"from_stop_id" uuid NOT NULL,
	"to_stop_id" uuid NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"vehicle_class" text,
	"default_layout_id" uuid,
	"active" boolean DEFAULT true,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trip_patterns_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "trip_stop_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"stop_sequence" integer NOT NULL,
	"arrive_at" timestamp with time zone,
	"depart_at" timestamp with time zone,
	"dwell_seconds" integer DEFAULT 0,
	"boarding_allowed" boolean,
	"alighting_allowed" boolean
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"layout_id" uuid,
	"capacity" integer NOT NULL,
	"status" "trip_status" DEFAULT 'scheduled',
	"channel_flags" jsonb DEFAULT '{"CSO":true,"WEB":false,"APP":false,"OTA":false}',
	"base_id" uuid,
	"origin_depart_hhmm" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"plate" text NOT NULL,
	"layout_id" uuid NOT NULL,
	"capacity" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vehicles_code_unique" UNIQUE("code"),
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_origin_stop_id_stops_id_fk" FOREIGN KEY ("origin_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destination_stop_id_stops_id_fk" FOREIGN KEY ("destination_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_stops" ADD CONSTRAINT "pattern_stops_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_stops" ADD CONSTRAINT "pattern_stops_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_inventory" ADD CONSTRAINT "seat_inventory_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_default_layout_id_layouts_id_fk" FOREIGN KEY ("default_layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_default_vehicle_id_vehicles_id_fk" FOREIGN KEY ("default_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_from_stop_id_stops_id_fk" FOREIGN KEY ("from_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_to_stop_id_stops_id_fk" FOREIGN KEY ("to_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_patterns" ADD CONSTRAINT "trip_patterns_default_layout_id_layouts_id_fk" FOREIGN KEY ("default_layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stop_times" ADD CONSTRAINT "trip_stop_times_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_stop_times" ADD CONSTRAINT "trip_stop_times_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_base_id_trip_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."trip_bases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;