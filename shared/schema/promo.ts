import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { promoTypeEnum, promoScopeEnum, voucherStatusEnum } from "./enums";

export const promotions = pgTable("promotions", {
  id:                uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:              text("code").notNull().unique(),
  name:              text("name").notNull(),
  description:       text("description"),
  type:              promoTypeEnum("type").notNull(),
  discountValue:     numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
  minPurchase:       numeric("min_purchase", { precision: 12, scale: 2 }).default('0'),
  maxDiscount:       numeric("max_discount", { precision: 12, scale: 2 }),
  scope:             promoScopeEnum("scope").default('global'),
  scopeRefId:        text("scope_ref_id"),
  applicableChannels: text("applicable_channels").array(),
  usageLimit:        integer("usage_limit"),
  usageCount:        integer("usage_count").default(0),
  perUserLimit:      integer("per_user_limit"),
  requireVoucher:    boolean("require_voucher").default(false),
  stackable:         boolean("stackable").default(false),
  isActive:          boolean("is_active").default(true),
  validFrom:         timestamp("valid_from", { withTimezone: true }),
  validTo:           timestamp("valid_to", { withTimezone: true }),
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const promotionsRelations = relations(promotions, ({ many }) => ({
  vouchers: many(vouchers)
}));

export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true, usageCount: true }).extend({
  validFrom: z.preprocess((v) => (typeof v === 'string' ? new Date(v) : v), z.date().nullable().optional()),
  validTo: z.preprocess((v) => (typeof v === 'string' ? new Date(v) : v), z.date().nullable().optional()),
});
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

export const vouchers = pgTable("vouchers", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:            text("code").notNull().unique(),
  promoId:         uuid("promo_id").notNull().references(() => promotions.id),
  assignedTo:      text("assigned_to"),
  status:          voucherStatusEnum("status").default('active'),
  usedAt:          timestamp("used_at", { withTimezone: true }),
  usedByBookingId: uuid("used_by_booking_id"),
  validFrom:       timestamp("valid_from", { withTimezone: true }),
  validTo:         timestamp("valid_to", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => ({
  idxVouchersPromoId: sql`CREATE INDEX IF NOT EXISTS idx_vouchers_promo_id ON ${table} (promo_id)`,
  idxVouchersStatus: sql`CREATE INDEX IF NOT EXISTS idx_vouchers_status ON ${table} (status)`
}));

export const vouchersRelations = relations(vouchers, ({ one }) => ({
  promotion: one(promotions, { fields: [vouchers.promoId], references: [promotions.id] })
}));

export const insertVoucherSchema = createInsertSchema(vouchers).omit({ id: true, createdAt: true });
export type Voucher = typeof vouchers.$inferSelect;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
