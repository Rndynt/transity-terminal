-- Engine compensation queue.
--
-- Stores best-effort engine inventory operations (currently only
-- cancel-seats) that failed AFTER the local TT transaction had already
-- committed. The scheduler retries these every minute when
-- RESERVATION_ENGINE_ENABLED=true.
--
-- See shared/schema/inventory.ts for the field-level documentation.

CREATE TABLE IF NOT EXISTS engine_compensation_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_type         text NOT NULL,
  trip_id         uuid NOT NULL,
  seat_no         text NOT NULL,
  leg_indexes     integer[] NOT NULL,
  context         jsonb,
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  last_attempt_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eng_comp_queue_ready
  ON engine_compensation_queue (attempts, created_at);
