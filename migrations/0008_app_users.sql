CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true,
	"avatar" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "app_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"id_number" text,
	"total_trips" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(15, 2) DEFAULT '0' NOT NULL,
	"first_trip_date" text,
	"last_trip_date" text,
	"preferred_seat" text,
	"preferred_route" text,
	"tag" "customer_tag" DEFAULT 'regular' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_app_users_phone ON "app_users" (phone) WHERE phone IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_app_users_active ON "app_users" (is_active) WHERE is_active = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customers_phone ON "customer_profiles" (phone);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customers_id_number ON "customer_profiles" (id_number) WHERE id_number IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customers_email ON "customer_profiles" (email) WHERE email IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_customers_tag ON "customer_profiles" (tag);
