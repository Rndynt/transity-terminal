-- S2-04: Dead-letter marker untuk engine_compensation_queue. Row dengan
-- attempts >= MAX_ATTEMPTS sekarang ditandai sekali via dead_lettered_at,
-- supaya alert hanya emit pada saat transisi (bukan setiap tick scheduler).
-- Index parsial mempercepat polling 'stuck count' di health/deep endpoint.

ALTER TABLE engine_compensation_queue
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_eng_comp_queue_dlq
  ON engine_compensation_queue (dead_lettered_at)
  WHERE dead_lettered_at IS NOT NULL;
