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
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seat_inventory" ADD CONSTRAINT "seat_inventory_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_seat_inv_trip_seat_leg" ON "seat_inventory" USING btree ("trip_id","seat_no","leg_index");
--> statement-breakpoint
CREATE INDEX "idx_seat_inv_trip_seat" ON "seat_inventory" USING btree ("trip_id","seat_no");
--> statement-breakpoint
CREATE INDEX "idx_seat_inv_trip_id" ON "seat_inventory" USING btree ("trip_id");
--> statement-breakpoint
CREATE INDEX "idx_seat_inv_trip_leg" ON "seat_inventory" USING btree ("trip_id","leg_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_trip_id ON "seat_holds" (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_expires_at ON "seat_holds" (expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_active ON "seat_holds" (trip_id, expires_at) WHERE booking_id IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_booking_id ON "seat_holds" (booking_id) WHERE booking_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_trip_seat ON "seat_holds" (trip_id, seat_no);
