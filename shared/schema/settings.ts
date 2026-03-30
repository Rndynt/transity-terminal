import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const operatorSettings = pgTable("operator_settings", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  brandName:      text("brand_name").notNull().default('Transity'),
  tagline:        text("tagline").notNull().default('Multi-Stop Travel System'),
  logoUrl:        text("logo_url"),
  primaryColor:   text("primary_color").notNull().default('#2563EB'),
  secondaryColor: text("secondary_color").notNull().default('#1E40AF'),
  accentColor:    text("accent_color").notNull().default('#F59E0B'),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertOperatorSettingsSchema = createInsertSchema(operatorSettings).omit({ id: true, updatedAt: true });
export type InsertOperatorSettings = z.infer<typeof insertOperatorSettingsSchema>;
export type OperatorSettings = typeof operatorSettings.$inferSelect;
