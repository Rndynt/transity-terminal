-- Performance indexes migration
-- Adds all missing indexes that were defined in Drizzle schema using raw sql()
-- but were never applied because drizzle-kit only processes typed index() definitions.
-- All statements use IF NOT EXISTS so re-running is safe.

-- ─── trips ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trips_service_date ON trips (service_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_pattern_id ON trips (pattern_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips (driver_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips (vehicle_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_pattern_date ON trips (pattern_id, service_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_base_date ON trips (base_id, service_date) WHERE base_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trips_date_status ON trips (service_date, status) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trip_base_per_day ON trips (base_id, service_date) WHERE base_id IS NOT NULL AND deleted_at IS NULL;

--> statement-breakpoint
-- ─── trip_stop_times ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tst_trip_id ON trip_stop_times (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tst_stop_id ON trip_stop_times (stop_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tst_trip_stop ON trip_stop_times (trip_id, stop_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tst_trip_seq ON trip_stop_times (trip_id, stop_sequence) WHERE deleted_at IS NULL;

--> statement-breakpoint
-- ─── trip_legs ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trip_legs_trip_id ON trip_legs (trip_id);

--> statement-breakpoint
-- ─── trip_closures ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trip_closures_trip_id ON trip_closures (trip_id);

--> statement-breakpoint
-- ─── trip_patterns ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trip_patterns_default_layout_id ON trip_patterns (default_layout_id) WHERE default_layout_id IS NOT NULL;

--> statement-breakpoint
-- ─── pattern_stops ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pattern_stops_pattern_id ON pattern_stops (pattern_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pattern_stops_stop_id ON pattern_stops (stop_id);

--> statement-breakpoint
-- ─── trip_bases ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trip_bases_active ON trip_bases (active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_bases_pattern ON trip_bases (pattern_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_trip_bases_valid ON trip_bases (valid_from, valid_to);

--> statement-breakpoint
-- ─── schedule_exceptions ─────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_exception_base_date ON schedule_exceptions (base_id, exception_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_schedule_exception_date ON schedule_exceptions (exception_date);

--> statement-breakpoint
-- ─── schedule_stop_exceptions ────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_stop_exception_base_date_stop ON schedule_stop_exceptions (base_id, exception_date, stop_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stop_exception_date ON schedule_stop_exceptions (exception_date);

--> statement-breakpoint
-- ─── bookings ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_trip_status ON bookings (trip_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_outlet_id ON bookings (outlet_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry ON bookings (pending_expires_at) WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_app_user_id ON bookings (app_user_id) WHERE app_user_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_group_id ON bookings (group_id) WHERE group_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_origin_stop ON bookings (origin_stop_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_destination_stop ON bookings (destination_stop_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bookings_outlet_created ON bookings (outlet_id, created_at DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookings_idempotency_key ON bookings (idempotency_key) WHERE idempotency_key IS NOT NULL;

--> statement-breakpoint
-- ─── booking_groups ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booking_groups_created_at ON booking_groups (created_at);

--> statement-breakpoint
-- ─── booking_promo_applications ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bpa_booking_id ON booking_promo_applications (booking_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bpa_promo_id ON booking_promo_applications (promo_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bpa_booking_promo ON booking_promo_applications (booking_id, promo_id);

--> statement-breakpoint
-- ─── booking_history ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON booking_history (booking_id);

--> statement-breakpoint
-- ─── passengers ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers (booking_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_passengers_booking_seat ON passengers (booking_id, seat_no);

--> statement-breakpoint
-- ─── payments ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments (provider_ref) WHERE provider_ref IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments (paid_at);
--> statement-breakpoint
-- Note: paid_at is timestamptz; ::date is timezone-dependent so NOT IMMUTABLE.
-- Use AT TIME ZONE 'UTC' to make the expression immutable.
CREATE INDEX IF NOT EXISTS idx_payments_paid_date ON payments ((paid_at AT TIME ZONE 'UTC')) WHERE status = 'success';

--> statement-breakpoint
-- ─── print_jobs ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_print_jobs_booking_id ON print_jobs (booking_id);

--> statement-breakpoint
-- ─── seat_holds ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seat_holds_trip_id ON seat_holds (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_expires_at ON seat_holds (expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_active ON seat_holds (trip_id, expires_at) WHERE booking_id IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_booking_id ON seat_holds (booking_id) WHERE booking_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_seat_holds_trip_seat ON seat_holds (trip_id, seat_no);

--> statement-breakpoint
-- ─── cargo_shipments ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cargo_trip_id ON cargo_shipments (trip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_status ON cargo_shipments (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_outlet_id ON cargo_shipments (outlet_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_trip_status ON cargo_shipments (trip_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_paid_at ON cargo_shipments (paid_at) WHERE paid_at IS NOT NULL;
--> statement-breakpoint
-- Note: paid_at is timestamptz; use AT TIME ZONE 'UTC' for an IMMUTABLE expression.
CREATE INDEX IF NOT EXISTS idx_cargo_paid_date ON cargo_shipments ((paid_at AT TIME ZONE 'UTC')) WHERE paid_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_outlet_created ON cargo_shipments (outlet_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_cargo_cargo_type_id ON cargo_shipments (cargo_type_id) WHERE cargo_type_id IS NOT NULL;

--> statement-breakpoint
-- ─── cargo_rates ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cargo_rates_lookup ON cargo_rates (cargo_type_id, scope, scope_ref_id, is_active);
