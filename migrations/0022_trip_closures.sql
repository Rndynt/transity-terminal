-- Idempotent by design: safe to run whether or not a given environment ever
-- applied the earlier (reverted) schedule_exception_groups migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedule_exceptions' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE schedule_exceptions DROP CONSTRAINT IF EXISTS schedule_exceptions_group_id_schedule_exception_groups_id_fk;
    DROP INDEX IF EXISTS idx_schedule_exceptions_group_id;
    ALTER TABLE schedule_exceptions DROP COLUMN IF EXISTS group_id;
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS schedule_exception_groups;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_closures" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"trip_id" uuid NOT NULL,
"reason" text,
"closed_by" text,
"closed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trip_closures_trip_id_trips_id_fk'
  ) THEN
    ALTER TABLE "trip_closures" ADD CONSTRAINT "trip_closures_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id");
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_closures_trip_id" ON "trip_closures" ("trip_id");
