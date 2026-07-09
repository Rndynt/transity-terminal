CREATE TABLE "schedule_exception_groups" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"reason" text NOT NULL,
"created_by" text,
"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD COLUMN "group_id" uuid;
--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_group_id_schedule_exception_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."schedule_exception_groups"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_schedule_exceptions_group_id" ON "schedule_exceptions" ("group_id");
