import { db } from "@server/db";
import { eq, desc, inArray } from "drizzle-orm";
import {
  tripCostTemplates, tripCostItems, promotions, promotionConditions, vouchers,
  bookingPromoApplications,
  type TripCostTemplate, type InsertTripCostTemplate,
  type TripCostItem, type InsertTripCostItem,
  type Promotion, type InsertPromotion,
  type PromoCondition, type PromoConditionInput,
  type Voucher, type InsertVoucher,
  type BookingPromoApplication, type InsertBookingPromoApplication
} from "@shared/schema";
import { sql } from "drizzle-orm";

export class FinanceRepository {
  async getTripCostTemplates(patternId?: string): Promise<TripCostTemplate[]> {
    if (patternId) {
      return await db.select().from(tripCostTemplates).where(eq(tripCostTemplates.patternId, patternId)).orderBy(tripCostTemplates.name);
    }
    return await db.select().from(tripCostTemplates).orderBy(tripCostTemplates.name);
  }

  async getTripCostTemplateById(id: string): Promise<TripCostTemplate | undefined> {
    const [template] = await db.select().from(tripCostTemplates).where(eq(tripCostTemplates.id, id));
    return template;
  }

  async createTripCostTemplate(data: InsertTripCostTemplate): Promise<TripCostTemplate> {
    const [template] = await db.insert(tripCostTemplates).values(data).returning();
    return template;
  }

  async updateTripCostTemplate(id: string, data: Partial<InsertTripCostTemplate>): Promise<TripCostTemplate> {
    const [template] = await db.update(tripCostTemplates).set(data).where(eq(tripCostTemplates.id, id)).returning();
    return template;
  }

  async deleteTripCostTemplate(id: string): Promise<void> {
    await db.delete(tripCostItems).where(eq(tripCostItems.templateId, id));
    await db.delete(tripCostTemplates).where(eq(tripCostTemplates.id, id));
  }

  async getTripCostItems(templateId: string): Promise<TripCostItem[]> {
    return await db.select().from(tripCostItems).where(eq(tripCostItems.templateId, templateId)).orderBy(tripCostItems.createdAt);
  }

  async createTripCostItem(data: InsertTripCostItem): Promise<TripCostItem> {
    const [item] = await db.insert(tripCostItems).values(data).returning();
    return item;
  }

  async updateTripCostItem(id: string, data: Partial<InsertTripCostItem>): Promise<TripCostItem> {
    const [item] = await db.update(tripCostItems).set(data).where(eq(tripCostItems.id, id)).returning();
    return item;
  }

  async deleteTripCostItem(id: string): Promise<void> {
    await db.delete(tripCostItems).where(eq(tripCostItems.id, id));
  }

  async getPromotions(): Promise<Promotion[]> {
    return await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  }

  async getPromotionById(id: string): Promise<Promotion | undefined> {
    const [promo] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promo;
  }

  async getPromotionByCode(code: string): Promise<Promotion | undefined> {
    const [promo] = await db.select().from(promotions).where(eq(promotions.code, code.toUpperCase()));
    return promo;
  }

  async createPromotion(data: InsertPromotion): Promise<Promotion> {
    const [promo] = await db.insert(promotions).values({ ...data, code: data.code.toUpperCase() }).returning();
    return promo;
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion> {
    if (data.code) data.code = data.code.toUpperCase();
    const [promo] = await db.update(promotions).set(data).where(eq(promotions.id, id)).returning();
    return promo;
  }

  async deletePromotion(id: string): Promise<void> {
    await db.delete(vouchers).where(eq(vouchers.promoId, id));
    await db.delete(promotionConditions).where(eq(promotionConditions.promoId, id));
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  async getPromoConditions(promoId: string): Promise<PromoCondition[]> {
    return await db.select().from(promotionConditions).where(eq(promotionConditions.promoId, promoId));
  }

  async getPromoConditionsForPromos(promoIds: string[]): Promise<Map<string, PromoCondition[]>> {
    const map = new Map<string, PromoCondition[]>();
    if (promoIds.length === 0) return map;
    const rows = await db.select().from(promotionConditions).where(inArray(promotionConditions.promoId, promoIds));
    for (const id of promoIds) map.set(id, []);
    for (const row of rows) {
      const list = map.get(row.promoId) ?? [];
      list.push(row);
      map.set(row.promoId, list);
    }
    return map;
  }

  async replacePromoConditions(promoId: string, conditions: PromoConditionInput[]): Promise<PromoCondition[]> {
    return await db.transaction(async (tx) => {
      await tx.delete(promotionConditions).where(eq(promotionConditions.promoId, promoId));
      if (conditions.length === 0) return [];
      return await tx.insert(promotionConditions).values(
        conditions.map(c => ({ promoId, type: c.type, values: c.values }))
      ).returning();
    });
  }

  async incrementPromoUsage(id: string): Promise<void> {
    await db.update(promotions).set({ usageCount: sql`${promotions.usageCount} + 1` }).where(eq(promotions.id, id));
  }

  async createBookingPromoApplications(rows: InsertBookingPromoApplication[]): Promise<BookingPromoApplication[]> {
    if (rows.length === 0) return [];
    return await db.insert(bookingPromoApplications).values(rows).returning();
  }

  async getBookingPromoApplications(bookingId: string): Promise<BookingPromoApplication[]> {
    return await db.select().from(bookingPromoApplications).where(eq(bookingPromoApplications.bookingId, bookingId));
  }

  async deleteBookingPromoApplications(bookingId: string): Promise<void> {
    await db.delete(bookingPromoApplications).where(eq(bookingPromoApplications.bookingId, bookingId));
  }

  async getVouchers(promoId?: string): Promise<Voucher[]> {
    if (promoId) {
      return await db.select().from(vouchers).where(eq(vouchers.promoId, promoId)).orderBy(desc(vouchers.createdAt));
    }
    return await db.select().from(vouchers).orderBy(desc(vouchers.createdAt));
  }

  async getVoucherById(id: string): Promise<Voucher | undefined> {
    const [v] = await db.select().from(vouchers).where(eq(vouchers.id, id));
    return v;
  }

  async getVoucherByCode(code: string): Promise<Voucher | undefined> {
    const [v] = await db.select().from(vouchers).where(eq(vouchers.code, code.toUpperCase()));
    return v;
  }

  async createVoucher(data: InsertVoucher): Promise<Voucher> {
    const [v] = await db.insert(vouchers).values({ ...data, code: data.code.toUpperCase() }).returning();
    return v;
  }

  async updateVoucher(id: string, data: Partial<InsertVoucher>): Promise<Voucher> {
    if (data.code) data.code = data.code.toUpperCase();
    const [v] = await db.update(vouchers).set(data).where(eq(vouchers.id, id)).returning();
    return v;
  }

  async deleteVoucher(id: string): Promise<void> {
    await db.delete(vouchers).where(eq(vouchers.id, id));
  }
}
