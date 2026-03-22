import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { costItemCategoryEnum } from "./enums";
import { tripPatterns } from "./scheduling";

export const tripCostTemplates = pgTable("trip_cost_templates", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patternId: uuid("pattern_id").notNull().references(() => tripPatterns.id),
  name:      text("name").notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const tripCostTemplatesRelations = relations(tripCostTemplates, ({ one, many }) => ({
  pattern: one(tripPatterns, { fields: [tripCostTemplates.patternId], references: [tripPatterns.id] }),
  items: many(tripCostItems)
}));

export const insertTripCostTemplateSchema = createInsertSchema(tripCostTemplates).omit({ id: true, createdAt: true });
export type TripCostTemplate = typeof tripCostTemplates.$inferSelect;
export type InsertTripCostTemplate = z.infer<typeof insertTripCostTemplateSchema>;

export const tripCostItems = pgTable("trip_cost_items", {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").notNull().references(() => tripCostTemplates.id),
  category:   costItemCategoryEnum("category").notNull(),
  label:      text("label").notNull(),
  amount:     numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isAdvance:  boolean("is_advance").notNull().default(true),
  notes:      text("notes"),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const tripCostItemsRelations = relations(tripCostItems, ({ one }) => ({
  template: one(tripCostTemplates, { fields: [tripCostItems.templateId], references: [tripCostTemplates.id] })
}));

export const insertTripCostItemSchema = createInsertSchema(tripCostItems).omit({ id: true, createdAt: true });
export type TripCostItem = typeof tripCostItems.$inferSelect;
export type InsertTripCostItem = z.infer<typeof insertTripCostItemSchema>;
