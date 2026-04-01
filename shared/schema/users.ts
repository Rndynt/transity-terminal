import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Tabel `users` — akun staff internal yang dikelola oleh Realmio (auth provider).
 * Berbeda dengan `app_users` yang merupakan pelanggan B2C dari aplikasi mobile.
 *
 * Kolom ini harus sinkron dengan struktur yang dibuat oleh Realmio.
 * Kolom-kolom ini juga diamankan oleh migrate.ts sebagai safety-net saat
 * Realmio membuat tabel dengan struktur minimalnya terlebih dahulu.
 */
export const users = pgTable("users", {
  id:            text("id").primaryKey(),
  email:         text("email").notNull(),
  name:          text("name"),
  image:         text("image"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  createdAt:     timestamp("createdAt").notNull().defaultNow(),
  updatedAt:     timestamp("updatedAt").notNull().defaultNow(),
  role:          text("role"),
});

export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
