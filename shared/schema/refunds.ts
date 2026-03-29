import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { refundStatusEnum } from "./enums";

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").notNull(),
  passengerId: uuid("passenger_id"),
  originalAmount: numeric("original_amount", { precision: 15, scale: 2 }).notNull(),
  refundAmount: numeric("refund_amount", { precision: 15, scale: 2 }).notNull(),
  adminFee: numeric("admin_fee", { precision: 15, scale: 2 }).notNull().default("0"),
  reason: text("reason"),
  refundMethod: text("refund_method"),
  status: refundStatusEnum("status").notNull().default('pending'),
  requestedBy: text("requested_by"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  processedBy: text("processed_by"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRefundSchema = createInsertSchema(refunds).omit({ id: true, createdAt: true, requestedAt: true });
export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = typeof insertRefundSchema._type;
