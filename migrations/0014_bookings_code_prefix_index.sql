-- 0014_bookings_code_prefix_index
-- P1 §3.5: Tambah btree index dengan text_pattern_ops untuk mendukung prefix
-- search (LIKE 'q%') pada `bookings.booking_code`. Unique index default
-- (varchar collated) tidak digunakan oleh planner untuk LIKE pattern di
-- non-C locale, sehingga endpoint /api/bookings/search dulunya
-- sequential-scan. Index ini memungkinkan index-range-scan untuk prefix
-- match.

CREATE INDEX IF NOT EXISTS "idx_bookings_booking_code_pattern"
  ON "bookings" ("booking_code" text_pattern_ops);
