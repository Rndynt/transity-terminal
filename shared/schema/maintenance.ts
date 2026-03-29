import { pgTable, uuid, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { maintenanceTypeEnum, maintenanceStatusEnum } from "./enums";

export const vehicleMaintenances = pgTable("vehicle_maintenances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: uuid("vehicle_id").notNull(),
  type: maintenanceTypeEnum("type").notNull(),
  description: text("description"),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  odometerKm: integer("odometer_km"),
  cost: numeric("cost", { precision: 15, scale: 2 }),
  vendorName: text("vendor_name"),
  status: maintenanceStatusEnum("status").notNull().default('scheduled'),
  nextServiceKm: integer("next_service_km"),
  nextServiceDate: text("next_service_date"),
  createdBy: text("created_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertVehicleMaintenanceSchema = createInsertSchema(vehicleMaintenances).omit({ id: true, createdAt: true, updatedAt: true });
export type VehicleMaintenance = typeof vehicleMaintenances.$inferSelect;
export type InsertVehicleMaintenance = typeof insertVehicleMaintenanceSchema._type;
