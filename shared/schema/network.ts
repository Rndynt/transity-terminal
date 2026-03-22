import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const stops = pgTable("stops", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:      text("code").notNull().unique(),
  name:      text("name").notNull(),
  city:      text("city"),
  isOutlet:  boolean("is_outlet").default(false),
  lat:       numeric("lat", { precision: 9, scale: 6 }),
  lng:       numeric("lng", { precision: 9, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const insertStopSchema = createInsertSchema(stops).omit({ id: true, createdAt: true });
export type Stop = typeof stops.$inferSelect;
export type InsertStop = z.infer<typeof insertStopSchema>;

export const outlets = pgTable("outlets", {
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stopId:           uuid("stop_id").notNull().references(() => stops.id).unique(),
  name:             text("name").notNull(),
  address:          text("address"),
  phone:            text("phone"),
  printerProfileId: text("printer_profile_id"),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt:        timestamp("deleted_at", { withTimezone: true })
});

export const insertOutletSchema = createInsertSchema(outlets).omit({ id: true, createdAt: true });
export type Outlet = typeof outlets.$inferSelect;
export type InsertOutlet = z.infer<typeof insertOutletSchema>;
