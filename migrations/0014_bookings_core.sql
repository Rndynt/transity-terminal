CREATE TABLE "booking_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_code" text NOT NULL,
	"type" text DEFAULT 'round_trip' NOT NULL,
	"channel" "channel" DEFAULT 'CSO' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"outlet_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "booking_groups_group_code_unique" UNIQUE("group_code")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_code" text NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"group_id" uuid,
	"leg_type" text DEFAULT 'single' NOT NULL,
	"trip_id" uuid NOT NULL,
	"origin_stop_id" uuid NOT NULL,
	"destination_stop_id" uuid NOT NULL,
	"origin_seq" integer NOT NULL,
	"destination_seq" integer NOT NULL,
	"channel" "channel" DEFAULT 'CSO',
	"outlet_id" uuid,
	"snap_origin_stop_name" text,
	"snap_destination_stop_name" text,
	"snap_departure_hhmm" text,
	"snap_outlet_name" text,
	"total_amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"promo_id" uuid,
	"voucher_code" text,
	"currency" text DEFAULT 'IDR',
	"created_by" text,
	"sales_channel_code" text,
	"sales_channel_name" text,
	"app_user_id" uuid,
	"pending_expires_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bookings_booking_code_unique" UNIQUE("booking_code")
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text,
	"ticket_status" "ticket_status" DEFAULT 'active',
	"booking_id" uuid NOT NULL,
	"seat_no" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"id_number" text,
	"fare_amount" numeric(12, 2) NOT NULL,
	"fare_breakdown" jsonb,
	CONSTRAINT "passengers_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending',
	"amount" numeric(12, 2) NOT NULL,
	"provider_ref" text,
	"paid_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_group_id_booking_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."booking_groups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_origin_stop_id_stops_id_fk" FOREIGN KEY ("origin_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destination_stop_id_stops_id_fk" FOREIGN KEY ("destination_stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promo_id_promotions_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
