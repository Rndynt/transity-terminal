import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, numeric, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { cargoRateKindEnum, cargoStatusEnum, channelEnum, paymentMethodEnum } from "./enums";
import { trips, tripPatterns } from "./scheduling";
import { stops, outlets } from "./network";

export const cargoTypes = pgTable("cargo_types", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:         text("code").notNull().unique(),
  name:         text("name").notNull(),
  isActive:     boolean("is_active").default(true),
  description:  text("description"),
  maxWeightKg:  numeric("max_weight_kg", { precision: 8, scale: 2 }),
  // Cargo OD-matrix identity swap: minCharge moved HERE from the rate/matrix
  // row. Rationale: a minimum charge is a property of the cargo type TIER
  // (kecil/sedang/besar/dokumen/...), independent of which route it ships
  // on — Rp 15.000 minimum for "Paket Mini" is the same whether it goes
  // JKT-BDG or JKT-SMG. Keeping it on the rate would mean re-entering the
  // same min-charge value in every single pattern×cargoType matrix cell
  // instead of once per cargo type.
  minCharge:    numeric("min_charge", { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true })
});

export const insertCargoTypeSchema = createInsertSchema(cargoTypes).omit({ id: true, createdAt: true });
export type CargoType = typeof cargoTypes.$inferSelect;
export type InsertCargoType = z.infer<typeof insertCargoTypeSchema>;

/**
 * OD-matrix pricing for CARGO. Full identity-swap of the old flat/scope-chain
 * `cargo_rates` (scope global|pattern|trip, one row per OD pair, price_per_kg
 * + price_per_leg + min_charge columns) — that shape is GONE. This table now
 * owns the `cargo_rates` name with the OD-matrix shape below, mirroring
 * `price_rules` (see shared/schema/pricing.ts) with ONE extra dimension:
 * every row is bound to a (pattern, cargoType) pair, not just a pattern.
 *
 * Differences from passenger `price_rules`, both deliberate:
 *   - NO `scope` column/global tier. Every row is pattern-scoped (patternId
 *     is NOT NULL here, unlike passenger's nullable patternId for its
 *     'global' rows) — cargo pricing always needs to know which physical
 *     route it's for, so a network-wide fallback price doesn't make sense
 *     the way it does for passenger fares. Trip-level overrides live in
 *     `cargo_rate_exceptions`, not a scope value.
 *   - Cells store `{ pricePerKg: number }`, not `{ price: number }` — the
 *     final amount is derived (pricePerKg * weightKg, clamped to the cargo
 *     type's minCharge) rather than being a flat fare.
 *
 * Precedence at resolve time (see cargoRates.resolver.ts):
 *   trip exception (cargo_rate_exceptions) > pattern (seasonal active-window
 *   > regular) > 0 ("Tarif belum diatur"). No global fallback.
 */
export const cargoRates = pgTable("cargo_rates", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cargoTypeId:  uuid("cargo_type_id").notNull().references(() => cargoTypes.id),
  patternId:    uuid("pattern_id").notNull().references(() => tripPatterns.id),
  // { version: 1, cells: { "<originStopId>|<destStopId>": { pricePerKg: number } } }
  // Keyed by stopId pair, NEVER by sequence (sequence is render-only).
  // Missing key or pricePerKg<=0 => "tarif belum diset".
  matrix:       jsonb("matrix").notNull().default(sql`'{"version":1,"cells":{}}'::jsonb`),
  kind:         cargoRateKindEnum("kind").notNull().default('regular'),
  name:         text("name"), // seasonal template name, e.g. "Tarif Lebaran 2026"
  validFrom:    timestamp("valid_from", { withTimezone: true }),
  validTo:      timestamp("valid_to", { withTimezone: true }),
  isActive:     boolean("is_active").notNull().default(true),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // optimistic lock
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  // Partial unique: one row per (cargoType, pattern, kind, window) while
  // alive. Regular rows always have valid_from/valid_to = NULL, so this
  // also guarantees at most one regular row per (cargoType, pattern).
  // (Supersedes the old idxCargoRatesLookup, which indexed the now-removed
  // scope/scope_ref_id columns from PR α-1 / migration 0025 — see
  // CARGO_OD_MATRIX_IMPLEMENTATION_REPORT.md.)
  uniqCargoTypePatternKindWindow: uniqueIndex("uniq_cargo_rate_cargo_type_pattern_kind_window")
    .on(table.cargoTypeId, table.patternId, table.kind, table.validFrom, table.validTo)
    .where(sql`deleted_at IS NULL`),
  idxPatternCargoType: index("idx_cargo_rates_pattern_cargo_type").on(table.patternId, table.cargoTypeId),
}));

export const cargoRatesRelations = relations(cargoRates, ({ one }) => ({
  cargoType: one(cargoTypes, { fields: [cargoRates.cargoTypeId], references: [cargoTypes.id] }),
  pattern: one(tripPatterns, { fields: [cargoRates.patternId], references: [tripPatterns.id] }),
}));

export const insertCargoRateSchema = createInsertSchema(cargoRates).omit({ id: true, createdAt: true });
export type CargoRate = typeof cargoRates.$inferSelect;
export type InsertCargoRate = z.infer<typeof insertCargoRateSchema>;

/** Shape of the `cargo_rates.matrix` jsonb column. */
export interface CargoRateBlob {
  version: 1;
  cells: Record<string, { pricePerKg: number }>;
}

/**
 * Sparse per-trip, per-OD, per-cargoType price override. NOT a matrix — one
 * row per overridden (cargoType, OD pair) on ONE specific materialized trip
 * (e.g. a promo rate for a single day's departure). Wins over any
 * `cargo_rates` tier. Mirrors `price_rule_exceptions` with an added
 * cargoType dimension (cargo has no equivalent of a single flat trip fare —
 * every override is still per cargo type).
 */
export const cargoRateExceptions = pgTable("cargo_rate_exceptions", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  cargoTypeId:        uuid("cargo_type_id").notNull().references(() => cargoTypes.id),
  originStopId:       uuid("origin_stop_id").notNull(),
  destinationStopId:  uuid("destination_stop_id").notNull(),
  pricePerKg:         numeric("price_per_kg", { precision: 12, scale: 2 }).notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:          timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  uniqTripCargoTypeOd: uniqueIndex("uniq_cargo_rate_exception_trip_cargo_type_od")
    .on(table.tripId, table.cargoTypeId, table.originStopId, table.destinationStopId)
    .where(sql`deleted_at IS NULL`),
  idxTripId: index("idx_cargo_rate_exception_trip_id").on(table.tripId),
}));

export const cargoRateExceptionsRelations = relations(cargoRateExceptions, ({ one }) => ({
  trip: one(trips, { fields: [cargoRateExceptions.tripId], references: [trips.id] }),
  cargoType: one(cargoTypes, { fields: [cargoRateExceptions.cargoTypeId], references: [cargoTypes.id] }),
}));

export const insertCargoRateExceptionSchema = createInsertSchema(cargoRateExceptions).omit({ id: true, createdAt: true });
export type CargoRateException = typeof cargoRateExceptions.$inferSelect;
export type InsertCargoRateException = z.infer<typeof insertCargoRateExceptionSchema>;

export const cargoShipments = pgTable("cargo_shipments", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  waybillNumber:      text("waybill_number").notNull().unique(),
  status:             cargoStatusEnum("status").default('received'),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull().references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").notNull().references(() => stops.id),
  outletId:           uuid("outlet_id").references(() => outlets.id),
  // Outlet tujuan tempat kargo akan diambil/dikirim, dipilih CSO setelah
  // trip dipilih (bisa ada >1 outlet per stop tujuan). Nullable untuk
  // kompatibilitas data lama sebelum kolom ini ada.
  destinationOutletId: uuid("destination_outlet_id").references(() => outlets.id),
  channel:            channelEnum("channel").default('CSO'),
  cargoTypeId:        uuid("cargo_type_id").references(() => cargoTypes.id),
  senderName:         text("sender_name").notNull(),
  senderPhone:        text("sender_phone").notNull(),
  recipientName:      text("recipient_name").notNull(),
  recipientPhone:      text("recipient_phone").notNull(),
  itemDescription:    text("item_description").notNull(),
  quantity:           integer("quantity").notNull().default(1),
  weightKg:           numeric("weight_kg", { precision: 8, scale: 2 }),
  lengthCm:           numeric("length_cm", { precision: 8, scale: 2 }),
  widthCm:            numeric("width_cm", { precision: 8, scale: 2 }),
  heightCm:           numeric("height_cm", { precision: 8, scale: 2 }),
  declaredValue:      numeric("declared_value", { precision: 12, scale: 2 }),
  totalAmount:        numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod:      paymentMethodEnum("payment_method"),
  paidAt:             timestamp("paid_at", { withTimezone: true }),
  notes:              text("notes"),
  // S1-06: secret yang harus disertakan saat tracking publik (mencegah
  // enumerasi waybill). Di-generate server-side di cargo.service.ts setiap
  // insert, tidak pernah expose ke operator UI; tercetak di label
  // pengirim/penerima. Tidak ada default DB — migration 0011 sudah backfill
  // row lama dan DROP DEFAULT di semua lingkungan.
  trackingSecret:     text("tracking_secret").notNull(),
  createdBy:          text("created_by"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxCargoTripId:       index('idx_cargo_trip_id').on(table.tripId),
  idxCargoStatus:       index('idx_cargo_status').on(table.status),
  idxCargoOutletId:     index('idx_cargo_outlet_id').on(table.outletId),
  idxCargoTripStatus:   index('idx_cargo_trip_status').on(table.tripId, table.status),
  idxCargoPaidAt:       index('idx_cargo_paid_at').on(table.paidAt).where(sql`paid_at IS NOT NULL`),
  // P3: functional index on paid_at grouped by UTC date for daily/monthly
  // cargo revenue reports. Uses AT TIME ZONE 'UTC' because paid_at is
  // timestamptz — plain ::date cast is timezone-dependent (NOT IMMUTABLE).
  idxCargoPaidDate:     index('idx_cargo_paid_date').on(sql`(paid_at AT TIME ZONE 'UTC')`).where(sql`paid_at IS NOT NULL`),
  idxCargoOutletCreated: index('idx_cargo_outlet_created').on(table.outletId, table.createdAt),
  idxCargoCargoType:    index('idx_cargo_cargo_type_id').on(table.cargoTypeId).where(sql`cargo_type_id IS NOT NULL`),
}));

export const cargoShipmentsRelations = relations(cargoShipments, ({ one }) => ({
  trip: one(trips, { fields: [cargoShipments.tripId], references: [trips.id] }),
  originStop: one(stops, { fields: [cargoShipments.originStopId], references: [stops.id], relationName: "cargoOriginStop" }),
  destinationStop: one(stops, { fields: [cargoShipments.destinationStopId], references: [stops.id], relationName: "cargoDestinationStop" }),
  outlet: one(outlets, { fields: [cargoShipments.outletId], references: [outlets.id] }),
  destinationOutlet: one(outlets, { fields: [cargoShipments.destinationOutletId], references: [outlets.id], relationName: "cargoDestinationOutlet" }),
  cargoType: one(cargoTypes, { fields: [cargoShipments.cargoTypeId], references: [cargoTypes.id] })
}));

const numericCoerce = z.union([z.string(), z.number().transform(String)]);
export const insertCargoShipmentSchema = createInsertSchema(cargoShipments)
  .omit({ id: true, createdAt: true, trackingSecret: true })
  .extend({
    weightKg: numericCoerce.optional().nullable(),
    lengthCm: numericCoerce.optional().nullable(),
    widthCm: numericCoerce.optional().nullable(),
    heightCm: numericCoerce.optional().nullable(),
    declaredValue: numericCoerce.optional().nullable(),
    totalAmount: numericCoerce,
    paidAt: z.union([z.date(), z.string().transform(s => new Date(s))]).optional().nullable()
  });
export type CargoShipment = typeof cargoShipments.$inferSelect;
export type InsertCargoShipment = z.infer<typeof insertCargoShipmentSchema>;

// S1-06: row shape khusus listing kargo untuk operator. Sengaja DROP
// `trackingSecret` (rahasia hanya muncul di label & endpoint tracking publik)
// dan menambahkan kolom join origin/destination stop yang dipakai UI daftar.
// Pisahkan dari `CargoShipment` agar mismatch select object langsung
// tertangkap TypeScript kalau ada yang menyelipkan/menghapus kolom di
// `getCargoShipments` (server/repositories/cargo.repository.ts).
export type CargoShipmentListItem = Omit<CargoShipment, 'trackingSecret'> & {
  originStopCode: string | null;
  originStopName: string | null;
  destinationStopCode: string | null;
  destinationStopName: string | null;
};
