CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" DEFAULT 'general' NOT NULL,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"target_user_id" text,
	"target_outlet_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"related_entity_type" text,
	"related_entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "operator_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_name" text DEFAULT 'Transity' NOT NULL,
	"tagline" text DEFAULT 'Multi-Stop Travel System' NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#2563EB' NOT NULL,
	"secondary_color" text DEFAULT '#1E40AF' NOT NULL,
	"accent_color" text DEFAULT '#F59E0B' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
