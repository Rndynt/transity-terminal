import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { driverStatusEnum } from "./enums";
import { users } from "./users";

export const drivers = pgTable("drivers", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:        text("code").notNull().unique(),
  name:        text("name").notNull(),
  phone:       text("phone").notNull(),
  licenseNo:   text("license_no").notNull(),
  licenseType: text("license_type").notNull().default('B2'),
  status:      driverStatusEnum("status").notNull().default('active'),
  notes:       text("notes"),
  userId:      text("user_id").references(() => users.id),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:   timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  idxDriversStatus: sql`CREATE INDEX IF NOT EXISTS idx_drivers_status ON ${table} (status) WHERE deleted_at IS NULL`,
  idxDriversActive: sql`CREATE INDEX IF NOT EXISTS idx_drivers_active ON ${table} (deleted_at) WHERE deleted_at IS NULL`,
  // Unique lookup index: resolves a logged-in user to their driver record.
  idxDriversUserId: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id ON ${table} (user_id) WHERE user_id IS NOT NULL`
}));

export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true, createdAt: true });
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export const layouts = pgTable("layouts", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name:      text("name").notNull(),
  rows:      integer("rows").notNull(),
  cols:      integer("cols").notNull(),
  seatMap:   jsonb("seat_map").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const insertLayoutSchema = createInsertSchema(layouts).omit({ id: true, createdAt: true });
export type Layout = typeof layouts.$inferSelect;
export type InsertLayout = z.infer<typeof insertLayoutSchema>;

export const vehicles = pgTable("vehicles", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:      text("code").notNull().unique(),
  plate:     text("plate").notNull().unique(),
  layoutId:  uuid("layout_id").notNull().references(() => layouts.id),
  capacity:  integer("capacity").notNull(),
  notes:     text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  // PR α-1: FK index untuk fleet ops (vehicles per layout). Migration 0015
  // mendaftarkan index yang sama dengan `IF NOT EXISTS`.
  idxVehiclesLayoutId: sql`CREATE INDEX IF NOT EXISTS idx_vehicles_layout_id ON ${table} (layout_id)`,
}));

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
