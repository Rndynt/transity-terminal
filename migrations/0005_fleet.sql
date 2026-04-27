CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"license_no" text NOT NULL,
	"license_type" text DEFAULT 'B2' NOT NULL,
	"status" "driver_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "drivers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rows" integer NOT NULL,
	"cols" integer NOT NULL,
	"seat_map" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
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
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vehicles_code_unique" UNIQUE("code"),
	CONSTRAINT "vehicles_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "vehicle_maintenances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" "maintenance_type" NOT NULL,
	"description" text,
	"scheduled_date" text,
	"completed_date" text,
	"odometer_km" integer,
	"cost" numeric(15, 2),
	"vendor_name" text,
	"status" "maintenance_status" DEFAULT 'scheduled' NOT NULL,
	"next_service_km" integer,
	"next_service_date" text,
	"created_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;
