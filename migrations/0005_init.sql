CREATE TYPE "public"."booking_history_action" AS ENUM('unseated', 'reassigned', 'rescheduled', 'canceled', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."spj_status" AS ENUM('draft', 'issued', 'on_trip', 'settled');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'unseated';--> statement-breakpoint
ALTER TYPE "public"."ticket_status" ADD VALUE 'unseated';--> statement-breakpoint
CREATE TABLE "booking_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"passenger_id" uuid,
	"action" "booking_history_action" NOT NULL,
	"details" jsonb,
	"performed_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "feature_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_flags" (
	"role_id" text NOT NULL,
	"flag_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "role_flags_role_id_flag_id_pk" PRIMARY KEY("role_id","flag_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"outlet_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "staff_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "cargo_types" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "layouts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pattern_stops" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stops" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_bases" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_patterns" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_stop_times" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_passenger_id_passengers_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."passengers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spj" ADD CONSTRAINT "spj_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spj" ADD CONSTRAINT "spj_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spj" ADD CONSTRAINT "spj_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spj_cost_lines" ADD CONSTRAINT "spj_cost_lines_spj_id_spj_id_fk" FOREIGN KEY ("spj_id") REFERENCES "public"."spj"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_flags" ADD CONSTRAINT "role_flags_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_flags" ADD CONSTRAINT "role_flags_flag_id_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;