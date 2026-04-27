CREATE TABLE "promotion_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_id" uuid NOT NULL,
	"type" text NOT NULL,
	"values" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
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
ALTER TABLE "promotion_conditions" ADD CONSTRAINT "promotion_conditions_promo_id_promotions_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_promo_id_promotions_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;
