CREATE TABLE "pattern_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"stop_sequence" integer NOT NULL,
	"boarding_allowed" boolean DEFAULT true NOT NULL,
	"alighting_allowed" boolean DEFAULT true NOT NULL,
	"dwell_seconds" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trip_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"active" boolean DEFAULT true,
	"vehicle_class" text,
	"default_layout_id" uuid,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "trip_patterns_code_unique" UNIQUE("code")
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
ALTER TABLE "pattern_stops" ADD CONSTRAINT "pattern_stops_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pattern_stops" ADD CONSTRAINT "pattern_stops_stop_id_stops_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stops"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_patterns" ADD CONSTRAINT "trip_patterns_default_layout_id_layouts_id_fk" FOREIGN KEY ("default_layout_id") REFERENCES "public"."layouts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_cost_items" ADD CONSTRAINT "trip_cost_items_template_id_trip_cost_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."trip_cost_templates"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_cost_templates" ADD CONSTRAINT "trip_cost_templates_pattern_id_trip_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."trip_patterns"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cost_templates_pattern_active ON "trip_cost_templates" (pattern_id, is_active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_cost_items_template_id ON "trip_cost_items" (template_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_patterns_default_layout_id ON "trip_patterns" (default_layout_id) WHERE default_layout_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pattern_stops_pattern_id ON "pattern_stops" (pattern_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pattern_stops_stop_id ON "pattern_stops" (stop_id);
