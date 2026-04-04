import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { cashierSessionStatusEnum } from "./enums";

export const cashierSessions = pgTable("cashier_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  outletId: uuid("outlet_id").notNull(),
  staffId: text("staff_id").notNull(),
  staffName: text("staff_name"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  status: cashierSessionStatusEnum("status").notNull().default('open'),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxCashierSessionsOutletStatus: sql`CREATE INDEX IF NOT EXISTS idx_cashier_sessions_outlet_status ON ${table} (outlet_id, status)`,
  idxCashierSessionsStaffId: sql`CREATE INDEX IF NOT EXISTS idx_cashier_sessions_staff_id ON ${table} (staff_id)`
}));

export const cashierSettlements = pgTable("cashier_settlements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull(),
  paymentMethod: text("payment_method").notNull(),
  systemAmount: numeric("system_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  actualAmount: numeric("actual_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  difference: numeric("difference", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
});

export const insertCashierSessionSchema = createInsertSchema(cashierSessions).omit({ id: true, createdAt: true, openedAt: true });
export const insertCashierSettlementSchema = createInsertSchema(cashierSettlements).omit({ id: true });
export type CashierSession = typeof cashierSessions.$inferSelect;
export type CashierSettlement = typeof cashierSettlements.$inferSelect;
