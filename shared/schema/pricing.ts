import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, numeric, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { passengerMatrixScopeEnum, passengerMatrixKindEnum } from "./enums";
import { trips, tripPatterns } from "./scheduling";

/**
 * OD-matrix pricing for PASSENGERS. Solves the structural gap where
 * `price_rules` (flat | per_leg) cannot express independent prices per
 * origin-destination pair on a 3+ city pattern (e.g. JKT-BDG 95k,
 * BDG-JOG 100k, JKT-JOG 200k — not linearly derivable from one another).
 *
 * Two base tiers (`scope`): 'global' (fallback across all patterns) and
 * 'pattern' (specific to one trip_patterns row). Pattern tier can also
 * have 'seasonal' rows (kind='seasonal') bound to a valid_from/valid_to
 * window (e.g. "Tarif Lebaran 2026") layered on top of the 'regular' row
 * for that same pattern, without mutating the regular row.
 *
 * Precedence at resolve time (see priceMatrix.resolver.ts):
 *   trip exception > pattern (seasonal active-window > regular) > global > 0
 *
 * Cargo will reuse the same JSONB shape + resolver helpers via its own
 * separate tables later (see priceMatrix.resolver.ts domain-agnostic
 * helpers) — do not couple this table to passenger-only assumptions
 * beyond its own rows.
 */
export const passengerPriceMatrices = pgTable("passenger_price_matrices", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  scope:      passengerMatrixScopeEnum("scope").notNull(),
  patternId:  uuid("pattern_id").references(() => tripPatterns.id), // null when scope='global'
  // { version: 1, cells: { "<originStopId>|<destStopId>": { price: number } } }
  // Keyed by stopId pair, NEVER by sequence (sequence is render-only, see
  // extractMatrixGrid). Missing key or price<=0 => "harga belum diset".
  matrix:     jsonb("matrix").notNull().default(sql`'{"version":1,"cells":{}}'::jsonb`),
  kind:       passengerMatrixKindEnum("kind").notNull().default('regular'),
  name:       text("name"), // seasonal template name, e.g. "Tarif Lebaran 2026"
  validFrom:  timestamp("valid_from", { withTimezone: true }),
  validTo:    timestamp("valid_to", { withTimezone: true }),
  isActive:   boolean("is_active").notNull().default(true),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // optimistic lock
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:  timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  // Partial unique: one row per (scope, pattern, kind, window) while alive.
  // Regular rows always have valid_from/valid_to = NULL, so this also
  // guarantees at most one regular row per (scope, pattern).
  uniqScopePatternKindWindow: uniqueIndex("uniq_passenger_matrix_scope_pattern_kind_window")
    .on(table.scope, table.patternId, table.kind, table.validFrom, table.validTo)
    .where(sql`deleted_at IS NULL`),
  idxPatternId: index("idx_passenger_matrix_pattern_id").on(table.patternId),
}));

/**
 * Sparse per-trip, per-OD price override. NOT a matrix — one row per
 * overridden OD pair on ONE specific materialized trip (e.g. a promo for
 * a single day's departure). Wins over any matrix tier.
 */
export const passengerPriceExceptions = pgTable("passenger_price_exceptions", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull(),
  destinationStopId:  uuid("destination_stop_id").notNull(),
  price:              numeric("price", { precision: 12, scale: 2 }).notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:          timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  uniqTripOd: uniqueIndex("uniq_passenger_price_exception_trip_od")
    .on(table.tripId, table.originStopId, table.destinationStopId)
    .where(sql`deleted_at IS NULL`),
  idxTripId: index("idx_passenger_price_exception_trip_id").on(table.tripId),
}));

export const insertPassengerPriceMatrixSchema = createInsertSchema(passengerPriceMatrices).omit({ id: true, createdAt: true });
export const insertPassengerPriceExceptionSchema = createInsertSchema(passengerPriceExceptions).omit({ id: true, createdAt: true });

export type PassengerPriceMatrix = typeof passengerPriceMatrices.$inferSelect;
export type InsertPassengerPriceMatrix = z.infer<typeof insertPassengerPriceMatrixSchema>;
export type PassengerPriceException = typeof passengerPriceExceptions.$inferSelect;
export type InsertPassengerPriceException = z.infer<typeof insertPassengerPriceExceptionSchema>;

/** Shape of the `matrix` jsonb column. */
export interface PassengerPriceMatrixBlob {
  version: 1;
  cells: Record<string, { price: number }>;
}
