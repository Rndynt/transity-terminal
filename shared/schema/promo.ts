import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, numeric, boolean, jsonb } from "drizzle-orm/pg-core";
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
  // Legacy scope columns — superseded by promotion_conditions table.
  // Kept on the model so Drizzle's introspection matches the live DB
  // (migration 0004_thin_xorn.sql). New code MUST read scope data from
  // promotion_conditions; do not write to these columns. A future
  // migration will drop them once backfill-promo-conditions.ts has been
  // run on every operator deployment.
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
}, (table) => ({
  idxPromotionsActiveValid: sql`CREATE INDEX IF NOT EXISTS idx_promotions_active_valid ON ${table} (is_active, valid_from, valid_to) WHERE is_active = true`
}));

export const PROMO_CONDITION_TYPES = ['route', 'trip', 'channel', 'outlet', 'sales_channel', 'day_of_week'] as const;
export type PromoConditionType = typeof PROMO_CONDITION_TYPES[number];

export const promotionConditions = pgTable("promotion_conditions", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  promoId:   uuid("promo_id").notNull().references(() => promotions.id, { onDelete: 'cascade' }),
  type:      text("type").notNull(),
  values:    jsonb("values").notNull().$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxPromoConditionsPromoId: sql`CREATE INDEX IF NOT EXISTS idx_promo_conditions_promo_id ON ${table} (promo_id)`,
}));

export const promotionsRelations = relations(promotions, ({ many }) => ({
  vouchers: many(vouchers),
  conditions: many(promotionConditions),
}));

export const promotionConditionsRelations = relations(promotionConditions, ({ one }) => ({
  promotion: one(promotions, { fields: [promotionConditions.promoId], references: [promotions.id] }),
}));

// Legacy scope columns (scope, scopeRefId, applicableChannels) are present
// on the table so Drizzle introspection matches the live DB, but the
// promos.controller create/update endpoints must NOT accept writes to
// them — promo evaluation reads exclusively from promotion_conditions
// (see promos.service.ts). If they were left in the insert schema an
// operator could PATCH `scope: 'trip'` and see no effect, which is
// worse than the column not existing at all.
export const insertPromotionSchema = createInsertSchema(promotions)
  .omit({
    id: true,
    createdAt: true,
    usageCount: true,
    scope: true,
    scopeRefId: true,
    applicableChannels: true,
  })
  .extend({
    validFrom: z.preprocess((v) => (typeof v === 'string' ? new Date(v) : v), z.date().nullable().optional()),
    validTo: z.preprocess((v) => (typeof v === 'string' ? new Date(v) : v), z.date().nullable().optional()),
  });
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

export const promoConditionInputSchema = z.object({
  type: z.enum(PROMO_CONDITION_TYPES),
  values: z.array(z.string().min(1)).min(1),
});
export type PromoConditionInput = z.infer<typeof promoConditionInputSchema>;
export type PromoCondition = typeof promotionConditions.$inferSelect;

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
