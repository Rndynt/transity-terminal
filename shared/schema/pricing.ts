import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, numeric, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { priceRuleScopeEnum, priceRuleKindEnum } from "./enums";
import { trips, tripPatterns } from "./scheduling";

/**
 * OD-matrix pricing for PASSENGERS. This IS `price_rules` — the identity
 * swap from the old flat/per_leg system is complete (see commit that
 * introduced this comment). The old flat/per_leg `price_rules` shape
 * (tripId/legIndex/priority/rule columns, scope values
 * pattern|trip|leg|time) is GONE; this table now owns the `price_rules`
 * name with the OD-matrix shape below. Solves the structural gap where the
 * old model couldn't express independent prices per origin-destination
 * pair on a 3+ city pattern (e.g. JKT-BDG 95k, BDG-JOG 100k, JKT-JOG 200k —
 * not linearly derivable from one another).
 *
 * Two base tiers (`scope`): 'global' (fallback across all patterns) and
 * 'pattern' (specific to one trip_patterns row). Pattern tier can also
 * have 'seasonal' rows (kind='seasonal') bound to a valid_from/valid_to
 * window (e.g. "Tarif Lebaran 2026") layered on top of the 'regular' row
 * for that same pattern, without mutating the regular row.
 *
 * Precedence at resolve time (see priceRules.resolver.ts):
 *   trip exception (price_rule_exceptions) > pattern (seasonal active-window
 *   > regular) > global > 0
 */
export const priceRules = pgTable("price_rules", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  scope:      priceRuleScopeEnum("scope").notNull(),
  patternId:  uuid("pattern_id").references(() => tripPatterns.id), // null when scope='global'
  // { version: 1, cells: { "<originStopId>|<destStopId>": { price: number } } }
  // Keyed by stopId pair, NEVER by sequence (sequence is render-only, see
  // extractMatrixGrid). Missing key or price<=0 => "harga belum diset".
  matrix:     jsonb("matrix").notNull().default(sql`'{"version":1,"cells":{}}'::jsonb`),
  kind:       priceRuleKindEnum("kind").notNull().default('regular'),
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
  uniqScopePatternKindWindow: uniqueIndex("uniq_price_rule_scope_pattern_kind_window")
    .on(table.scope, table.patternId, table.kind, table.validFrom, table.validTo)
    .where(sql`deleted_at IS NULL`),
  idxPatternId: index("idx_price_rules_pattern_id").on(table.patternId),
}));

/**
 * Sparse per-trip, per-OD price override. NOT a matrix — one row per
 * overridden OD pair on ONE specific materialized trip (e.g. a promo for
 * a single day's departure). Wins over any price_rules tier.
 */
export const priceRuleExceptions = pgTable("price_rule_exceptions", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull(),
  destinationStopId:  uuid("destination_stop_id").notNull(),
  price:              numeric("price", { precision: 12, scale: 2 }).notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:          timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  uniqTripOd: uniqueIndex("uniq_price_rule_exception_trip_od")
    .on(table.tripId, table.originStopId, table.destinationStopId)
    .where(sql`deleted_at IS NULL`),
  idxTripId: index("idx_price_rule_exception_trip_id").on(table.tripId),
}));

export const insertPriceRuleSchema = createInsertSchema(priceRules).omit({ id: true, createdAt: true });
export const insertPriceRuleExceptionSchema = createInsertSchema(priceRuleExceptions).omit({ id: true, createdAt: true });

export type PriceRule = typeof priceRules.$inferSelect;
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;
export type PriceRuleException = typeof priceRuleExceptions.$inferSelect;
export type InsertPriceRuleException = z.infer<typeof insertPriceRuleExceptionSchema>;

/** Shape of the `matrix` jsonb column. */
export interface PriceRuleBlob {
  version: 1;
  cells: Record<string, { price: number }>;
}
