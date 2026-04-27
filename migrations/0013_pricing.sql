CREATE TABLE "price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "price_rule_scope" NOT NULL,
	"pattern_id" uuid,
	"trip_id" uuid,
	"leg_index" integer,
	"priority" integer DEFAULT 0,
	"rule" jsonb NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
