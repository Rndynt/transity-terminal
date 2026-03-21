CREATE TYPE "public"."cost_item_category" AS ENUM('bbm', 'tol', 'makan', 'parkir', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."promo_scope" AS ENUM('global', 'pattern', 'trip', 'outlet', 'channel');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('active', 'canceled', 'refunded', 'checked_in', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('active', 'used', 'expired', 'revoked');--> statement-breakpoint
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
	CONSTRAINT "drivers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "promo_type" NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"min_purchase" numeric(12, 2) DEFAULT '0',
	"max_discount" numeric(12, 2),
	"scope" "promo_scope" DEFAULT 'global',
	"scope_ref_id" text,
	"applicable_channels" text[],
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0,
	"per_user_limit" integer,
	"require_voucher" boolean DEFAULT false,
	"stackable" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "promotions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "trip_cost_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"category" "cost_item_category" NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_advance" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trip_cost_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"promo_id" uuid NOT NULL,
	"assigned_to" text,
	"status" "voucher_status" DEFAULT 'active',
	"used_at" timestamp with time zone,
	"used_by_booking_id" uuid,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "promo_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "voucher_code" text;--> statement-breakpoint
ALTER TABLE "passengers" ADD COLUMN "ticket_number" text;--> statement-breakpoint
ALTER TABLE "passengers" ADD COLUMN "ticket_status" "ticket_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "trip_bases" ADD COLUMN "default_driver_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_patterns" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "driver_id" uuid;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "manifest_first_printed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_cost_items" ADD CONSTRAINT "trip_cost_items_template_id_trip_cost_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."trip_cost_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_cost_templates" ADD CONSTRAINT "trip_cost_templates_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_promo_id_promotions_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bases" ADD CONSTRAINT "trip_bases_default_driver_id_drivers_id_fk" FOREIGN KEY ("default_driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booking_code_unique" UNIQUE("booking_code");--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_ticket_number_unique" UNIQUE("ticket_number");