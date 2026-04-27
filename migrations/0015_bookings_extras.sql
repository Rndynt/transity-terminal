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
CREATE TABLE "booking_promo_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"promo_id" uuid NOT NULL,
	"promo_code" text NOT NULL,
	"voucher_id" uuid,
	"voucher_code" text,
	"source" text NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
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
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"booking_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"passenger_id" uuid,
	"original_amount" numeric(15, 2) NOT NULL,
	"refund_amount" numeric(15, 2) NOT NULL,
	"admin_fee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"reason" text,
	"refund_method" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"requested_by" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"processed_by" text,
	"processed_at" timestamp with time zone,
	"bank_account" text,
	"bank_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_passenger_id_passengers_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."passengers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_promo_applications" ADD CONSTRAINT "booking_promo_applications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_promo_applications" ADD CONSTRAINT "booking_promo_applications_promo_id_promotions_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_promo_applications" ADD CONSTRAINT "booking_promo_applications_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
