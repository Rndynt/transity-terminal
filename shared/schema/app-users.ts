import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Tabel `app_users` — pelanggan B2C dari aplikasi mobile Transity.
 * Berbeda dengan `users` (staff internal) yang dikelola Realmio.
 *
 * Punya kolom sendiri untuk auth (passwordHash) karena pelanggan mobile
 * tidak menggunakan Realmio, melainkan auth internal aplikasi.
 */
export const appUsers = pgTable("app_users", {
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email:        text("email").notNull().unique(),
  name:         text("name").notNull(),
  phone:        text("phone"),
  isActive:     boolean("is_active").default(true),
  avatar:       text("avatar"),
  passwordHash: text("password_hash").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxAppUsersPhone: sql`CREATE INDEX IF NOT EXISTS idx_app_users_phone ON ${table} (phone) WHERE phone IS NOT NULL`,
  idxAppUsersActive: sql`CREATE INDEX IF NOT EXISTS idx_app_users_active ON ${table} (is_active) WHERE is_active = true`
}));

export const insertAppUserSchema = createInsertSchema(appUsers).omit({ id: true, createdAt: true });
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
