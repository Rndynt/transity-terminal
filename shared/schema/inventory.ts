import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { trips } from "./scheduling";

export const seatInventory = pgTable("seat_inventory", {
  id:       uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:   uuid("trip_id").notNull().references(() => trips.id),
  seatNo:   text("seat_no").notNull(),
  legIndex: integer("leg_index").notNull(),
  booked:   boolean("booked").default(false),
  holdRef:  text("hold_ref")
}, (table) => ({
  uniqTripSeatLeg: uniqueIndex("uniq_seat_inv_trip_seat_leg").on(table.tripId, table.seatNo, table.legIndex),
  idxSeatInvTripSeat: index("idx_seat_inv_trip_seat").on(table.tripId, table.seatNo),
  idxSeatInvTripId: index("idx_seat_inv_trip_id").on(table.tripId),
  idxSeatInvTripLeg: index("idx_seat_inv_trip_leg").on(table.tripId, table.legIndex),
}));

export const insertSeatInventorySchema = createInsertSchema(seatInventory).omit({ id: true });
export type SeatInventory = typeof seatInventory.$inferSelect;
export type InsertSeatInventory = z.infer<typeof insertSeatInventorySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// engine_compensation_queue — durable retry queue for best-effort engine
// inventory operations that failed AFTER the local TT transaction already
// committed. Without this, a transient engine outage would leak seats: the
// local booking state would be consistent (e.g. ticket cancelled, passenger
// unseated, reschedule completed) but the engine would still consider the
// seat booked, removing it from sale.
//
// The scheduler picks pending rows every minute (only when
// RESERVATION_ENGINE_ENABLED=true) and retries the cancel-seats call.
// Successful rows are deleted; failed rows have their attempt counter
// incremented and the latest error stored. Rows that exceed a hard cap
// (default 50 attempts) are kept around with `attempts >= cap` so an
// operator can spot them via SQL — they are never silently dropped.
// ─────────────────────────────────────────────────────────────────────────────
export const engineCompensationQueue = pgTable("engine_compensation_queue", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Operation type. Currently only 'cancel_seats' is supported. Stored as
  // text (not enum) to keep follow-up extensibility cheap.
  opType:        text("op_type").notNull(),
  tripId:        uuid("trip_id").notNull(),
  seatNo:        text("seat_no").notNull(),
  legIndexes:    integer("leg_indexes").array().notNull(),
  // Free-form context for forensics (originating booking id, source code path).
  context:       jsonb("context"),
  attempts:      integer("attempts").notNull().default(0),
  lastError:     text("last_error"),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  // S2-04: timestamp ketika row resmi masuk DLQ (attempts mencapai MAX).
  // NULL = masih retry-able. Non-NULL = parked, butuh intervensi manual.
  // Set sekali (idempotent) supaya alert tidak di-emit berulang setiap tick.
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Worker reads "oldest first, attempts < cap" — composite index covers it.
  idxQueueReady: index("idx_eng_comp_queue_ready").on(table.attempts, table.createdAt),
}));

export type EngineCompensationQueueRow = typeof engineCompensationQueue.$inferSelect;

export const seatHolds = pgTable("seat_holds", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  holdRef:     text("hold_ref").notNull().unique(),
  tripId:      uuid("trip_id").notNull().references(() => trips.id),
  seatNo:      text("seat_no").notNull(),
  legIndexes:  integer("leg_indexes").array().notNull(),
  ttlClass:    text("ttl_class").notNull(),
  operatorId:  text("operator_id").notNull(),
  bookingId:   text("booking_id"),
  expiresAt:   timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxSeatHoldsTripId: sql`CREATE INDEX IF NOT EXISTS idx_seat_holds_trip_id ON ${table} (trip_id)`,
  idxSeatHoldsExpiresAt: sql`CREATE INDEX IF NOT EXISTS idx_seat_holds_expires_at ON ${table} (expires_at)`,
  idxSeatHoldsActive: sql`CREATE INDEX IF NOT EXISTS idx_seat_holds_active ON ${table} (trip_id, expires_at) WHERE booking_id IS NULL`,
  idxSeatHoldsBookingId: sql`CREATE INDEX IF NOT EXISTS idx_seat_holds_booking_id ON ${table} (booking_id) WHERE booking_id IS NOT NULL`,
  idxSeatHoldsTripSeat: sql`CREATE INDEX IF NOT EXISTS idx_seat_holds_trip_seat ON ${table} (trip_id, seat_no)`
}));

// NOTE: `price_rules` used to live here (flat/per_leg pricing rules). It has
// been fully replaced by the OD-matrix pricing system — the `priceRules`
// table now lives in ./pricing.ts under the SAME name (identity swap), with
// a different shape (jsonb matrix keyed by stopId pairs, no more
// tripId/legIndex/priority/rule columns). See shared/schema/pricing.ts.
