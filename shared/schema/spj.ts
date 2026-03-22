import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { spjStatusEnum, costItemCategoryEnum } from "./enums";
import { trips } from "./scheduling";
import { drivers, vehicles } from "./fleet";

export const spj = pgTable("spj", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  spjNumber:    text("spj_number").unique().notNull(),
  tripId:       uuid("trip_id").notNull().references(() => trips.id),
  driverId:     uuid("driver_id").notNull().references(() => drivers.id),
  vehicleId:    uuid("vehicle_id").notNull().references(() => vehicles.id),
  status:       spjStatusEnum("status").default('draft'),
  issuedAt:     timestamp("issued_at", { withTimezone: true }),
  settledAt:    timestamp("settled_at", { withTimezone: true }),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxSpjTripId: sql`CREATE INDEX IF NOT EXISTS idx_spj_trip_id ON ${table} (trip_id)`,
  idxSpjStatus: sql`CREATE INDEX IF NOT EXISTS idx_spj_status ON ${table} (status)`,
  idxSpjDriverId: sql`CREATE INDEX IF NOT EXISTS idx_spj_driver_id ON ${table} (driver_id)`
}));

export const spjRelations = relations(spj, ({ one, many }) => ({
  trip: one(trips, { fields: [spj.tripId], references: [trips.id] }),
  driver: one(drivers, { fields: [spj.driverId], references: [drivers.id] }),
  vehicle: one(vehicles, { fields: [spj.vehicleId], references: [vehicles.id] }),
  costLines: many(spjCostLines)
}));

export const insertSpjSchema = createInsertSchema(spj).omit({ id: true, createdAt: true, updatedAt: true });
export type Spj = typeof spj.$inferSelect;
export type InsertSpj = z.infer<typeof insertSpjSchema>;

export const spjCostLines = pgTable("spj_cost_lines", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  spjId:           uuid("spj_id").notNull().references(() => spj.id),
  category:        costItemCategoryEnum("category").notNull(),
  label:           text("label").notNull(),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }).notNull(),
  actualAmount:    numeric("actual_amount", { precision: 12, scale: 2 }),
  isAdvance:       boolean("is_advance").notNull().default(true),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const spjCostLinesRelations = relations(spjCostLines, ({ one }) => ({
  spj: one(spj, { fields: [spjCostLines.spjId], references: [spj.id] })
}));

export const insertSpjCostLineSchema = createInsertSchema(spjCostLines).omit({ id: true, createdAt: true });
export type SpjCostLine = typeof spjCostLines.$inferSelect;
export type InsertSpjCostLine = z.infer<typeof insertSpjCostLineSchema>;

export type SpjWithDetails = Spj & {
  driverName?: string | null;
  driverCode?: string | null;
  driverPhone?: string | null;
  driverLicenseNo?: string | null;
  vehicleCode?: string | null;
  vehiclePlate?: string | null;
  tripServiceDate?: string | null;
  tripPatternName?: string | null;
  tripPatternCode?: string | null;
  costLines?: SpjCostLine[];
};
