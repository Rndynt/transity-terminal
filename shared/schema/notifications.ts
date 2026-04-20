import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { notificationSeverityEnum, notificationTypeEnum } from "./enums";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: notificationTypeEnum("type").notNull().default('general'),
  severity: notificationSeverityEnum("severity").notNull().default('info'),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetUserId: text("target_user_id"),
  targetOutletId: uuid("target_outlet_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({
  idxNotifTargetUser: sql`CREATE INDEX IF NOT EXISTS idx_notifications_target_user_created ON ${table} (target_user_id, created_at DESC) WHERE target_user_id IS NOT NULL`,
  idxNotifTargetOutlet: sql`CREATE INDEX IF NOT EXISTS idx_notifications_target_outlet_created ON ${table} (target_outlet_id, created_at DESC) WHERE target_outlet_id IS NOT NULL`,
  idxNotifUnread: sql`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON ${table} (target_user_id, is_read) WHERE is_read = false AND target_user_id IS NOT NULL`,
  idxNotifExpires: sql`CREATE INDEX IF NOT EXISTS idx_notifications_expires ON ${table} (expires_at) WHERE expires_at IS NOT NULL`
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof insertNotificationSchema._type;
