import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const appUsers = pgTable("app_users", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email:        text("email").notNull().unique(),
  name:         text("name").notNull(),
  phone:        text("phone"),
  isActive:     boolean("is_active").default(true),
  avatar:       text("avatar"),
  passwordHash: text("password_hash").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const insertAppUserSchema = createInsertSchema(appUsers).omit({ id: true, createdAt: true });
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;

export const users = pgTable("users", {
  id:       uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
