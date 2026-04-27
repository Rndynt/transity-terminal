CREATE TABLE "engine_compensation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"op_type" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"seat_no" text NOT NULL,
	"leg_indexes" integer[] NOT NULL,
	"context" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_eng_comp_queue_ready" ON "engine_compensation_queue" USING btree ("attempts","created_at");
