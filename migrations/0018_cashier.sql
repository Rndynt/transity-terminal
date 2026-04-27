CREATE TABLE "cashier_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"staff_id" text NOT NULL,
	"staff_name" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opening_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" "cashier_session_status" DEFAULT 'open' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashier_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"payment_method" text NOT NULL,
	"system_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"actual_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"difference" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
