import { pgTable, uuid, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { customerTagEnum } from "./enums";

export const customerProfiles = pgTable("customer_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  idNumber: text("id_number"),
  totalTrips: integer("total_trips").notNull().default(0),
  totalSpent: numeric("total_spent", { precision: 15, scale: 2 }).notNull().default("0"),
  firstTripDate: text("first_trip_date"),
  lastTripDate: text("last_trip_date"),
  preferredSeat: text("preferred_seat"),
  preferredRoute: text("preferred_route"),
  tag: customerTagEnum("tag").notNull().default('regular'),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxCustomersPhone: sql`CREATE INDEX IF NOT EXISTS idx_customers_phone ON ${table} (phone)`,
  idxCustomersIdNumber: sql`CREATE INDEX IF NOT EXISTS idx_customers_id_number ON ${table} (id_number) WHERE id_number IS NOT NULL`,
  idxCustomersEmail: sql`CREATE INDEX IF NOT EXISTS idx_customers_email ON ${table} (email) WHERE email IS NOT NULL`,
  idxCustomersTag: sql`CREATE INDEX IF NOT EXISTS idx_customers_tag ON ${table} (tag)`
}));

export const insertCustomerProfileSchema = createInsertSchema(customerProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = typeof insertCustomerProfileSchema._type;
