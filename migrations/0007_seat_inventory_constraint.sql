-- Add unique index on seat_inventory (trip_id, seat_no, leg_index) to enable ON CONFLICT upsert
-- Using CREATE UNIQUE INDEX (supports IF NOT EXISTS, fully idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_seat_inv_trip_seat_leg"
  ON "seat_inventory" ("trip_id", "seat_no", "leg_index");
