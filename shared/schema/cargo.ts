import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { cargoRateScopeEnum, cargoStatusEnum, channelEnum, paymentMethodEnum } from "./enums";
import { trips } from "./scheduling";
import { stops, outlets } from "./network";

export const cargoTypes = pgTable("cargo_types", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:         text("code").notNull().unique(),
  name:         text("name").notNull(),
  isActive:     boolean("is_active").default(true),
  description:  text("description"),
  maxWeightKg:  numeric("max_weight_kg", { precision: 8, scale: 2 }),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true })
});

export const insertCargoTypeSchema = createInsertSchema(cargoTypes).omit({ id: true, createdAt: true });
export type CargoType = typeof cargoTypes.$inferSelect;
export type InsertCargoType = z.infer<typeof insertCargoTypeSchema>;

export const cargoRates = pgTable("cargo_rates", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cargoTypeId:        uuid("cargo_type_id").notNull().references(() => cargoTypes.id),
  scope:              cargoRateScopeEnum("scope").notNull().default('global'),
  scopeRefId:         uuid("scope_ref_id"),
  originStopId:       uuid("origin_stop_id").references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").references(() => stops.id),
  isActive:           boolean("is_active").default(true),
  pricePerKg:         numeric("price_per_kg", { precision: 12, scale: 2 }).notNull(),
  pricePerLeg:        numeric("price_per_leg", { precision: 12, scale: 2 }).notNull().default('0'),
  minCharge:          numeric("min_charge", { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const cargoRatesRelations = relations(cargoRates, ({ one }) => ({
  cargoType: one(cargoTypes, { fields: [cargoRates.cargoTypeId], references: [cargoTypes.id] }),
  originStop: one(stops, { fields: [cargoRates.originStopId], references: [stops.id], relationName: "cargoRateOriginStop" }),
  destinationStop: one(stops, { fields: [cargoRates.destinationStopId], references: [stops.id], relationName: "cargoRateDestinationStop" })
}));

export const insertCargoRateSchema = createInsertSchema(cargoRates).omit({ id: true, createdAt: true });
export type CargoRate = typeof cargoRates.$inferSelect;
export type InsertCargoRate = z.infer<typeof insertCargoRateSchema>;

export const cargoShipments = pgTable("cargo_shipments", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  waybillNumber:      text("waybill_number").notNull().unique(),
  status:             cargoStatusEnum("status").default('received'),
  tripId:             uuid("trip_id").notNull().references(() => trips.id),
  originStopId:       uuid("origin_stop_id").notNull().references(() => stops.id),
  destinationStopId:  uuid("destination_stop_id").notNull().references(() => stops.id),
  outletId:           uuid("outlet_id").references(() => outlets.id),
  channel:            channelEnum("channel").default('CSO'),
  cargoTypeId:        uuid("cargo_type_id").references(() => cargoTypes.id),
  senderName:         text("sender_name").notNull(),
  senderPhone:        text("sender_phone").notNull(),
  recipientName:      text("recipient_name").notNull(),
  recipientPhone:     text("recipient_phone").notNull(),
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
  createdBy:          text("created_by"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxCargoTripId: sql`CREATE INDEX IF NOT EXISTS idx_cargo_trip_id ON ${table} (trip_id)`,
  idxCargoStatus: sql`CREATE INDEX IF NOT EXISTS idx_cargo_status ON ${table} (status)`,
  idxCargoOutletId: sql`CREATE INDEX IF NOT EXISTS idx_cargo_outlet_id ON ${table} (outlet_id)`,
  idxCargoTripStatus: sql`CREATE INDEX IF NOT EXISTS idx_cargo_trip_status ON ${table} (trip_id, status)`,
  idxCargoPaidAt: sql`CREATE INDEX IF NOT EXISTS idx_cargo_paid_at ON ${table} (paid_at) WHERE paid_at IS NOT NULL`,
  idxCargoOutletCreated: sql`CREATE INDEX IF NOT EXISTS idx_cargo_outlet_created ON ${table} (outlet_id, created_at DESC)`,
  idxCargoCargoType: sql`CREATE INDEX IF NOT EXISTS idx_cargo_cargo_type_id ON ${table} (cargo_type_id) WHERE cargo_type_id IS NOT NULL`
}));

export const cargoShipmentsRelations = relations(cargoShipments, ({ one }) => ({
  trip: one(trips, { fields: [cargoShipments.tripId], references: [trips.id] }),
  originStop: one(stops, { fields: [cargoShipments.originStopId], references: [stops.id], relationName: "cargoOriginStop" }),
  destinationStop: one(stops, { fields: [cargoShipments.destinationStopId], references: [stops.id], relationName: "cargoDestinationStop" }),
  outlet: one(outlets, { fields: [cargoShipments.outletId], references: [outlets.id] }),
  cargoType: one(cargoTypes, { fields: [cargoShipments.cargoTypeId], references: [cargoTypes.id] })
}));

const numericCoerce = z.union([z.string(), z.number().transform(String)]);
export const insertCargoShipmentSchema = createInsertSchema(cargoShipments)
  .omit({ id: true, createdAt: true })
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
