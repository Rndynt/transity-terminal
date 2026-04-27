CREATE TABLE "feature_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_flags" (
	"role_id" text NOT NULL,
	"flag_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "role_flags_role_id_flag_id_pk" PRIMARY KEY("role_id","flag_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"outlet_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "staff_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "role_flags" ADD CONSTRAINT "role_flags_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_flags" ADD CONSTRAINT "role_flags_flag_id_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_staff_members_role_id ON "staff_members" (role_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_staff_members_outlet_id ON "staff_members" (outlet_id) WHERE outlet_id IS NOT NULL;
