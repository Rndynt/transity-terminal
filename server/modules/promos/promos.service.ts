import { IStorage } from "@server/storage.interface";
import { type Promotion, type Voucher, type InsertPromotion, type InsertVoucher, type PromoCondition, type PromoConditionInput } from "@shared/schema";
import crypto from "crypto";

export interface PromoValidationResult {
  valid: boolean;
  promotion?: Promotion;
  voucher?: Voucher;
  discountAmount: number;
  error?: string;
}

export class PromosService {
  constructor(private storage: IStorage) {}

  async getAllPromotions(): Promise<Promotion[]> {
    return this.storage.getPromotions();
  }

  async getPromotionById(id: string): Promise<Promotion> {
    const promo = await this.storage.getPromotionById(id);
    if (!promo) throw new Error('Promotion not found');
    return promo;
  }

  async createPromotion(data: InsertPromotion): Promise<Promotion> {
    const existing = await this.storage.getPromotionByCode(data.code);
    if (existing) throw new Error('Kode promo sudah digunakan');
    return this.storage.createPromotion(data);
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion> {
    if (data.code) {
      const existing = await this.storage.getPromotionByCode(data.code);
      if (existing && existing.id !== id) throw new Error('Kode promo sudah digunakan');
    }
    return this.storage.updatePromotion(id, data);
  }

  async deletePromotion(id: string): Promise<void> {
    return this.storage.deletePromotion(id);
  }

  async getConditions(promoId: string): Promise<PromoCondition[]> {
    return this.storage.getPromoConditions(promoId);
  }

  async replaceConditions(promoId: string, conditions: PromoConditionInput[]): Promise<PromoCondition[]> {
    const promo = await this.storage.getPromotionById(promoId);
    if (!promo) throw new Error('Promotion not found');
    return this.storage.replacePromoConditions(promoId, conditions);
  }

  async getVouchers(promoId?: string): Promise<Voucher[]> {
    return this.storage.getVouchers(promoId);
  }

  async getVoucherById(id: string): Promise<Voucher> {
    const v = await this.storage.getVoucherById(id);
    if (!v) throw new Error('Voucher not found');
    return v;
  }

  async generateVouchers(promoId: string, count: number, prefix?: string, assignedTo?: string): Promise<Voucher[]> {
    const promo = await this.storage.getPromotionById(promoId);
    if (!promo) throw new Error('Promotion not found');

    const results: Voucher[] = [];
    for (let i = 0; i < count; i++) {
      const code = this.generateVoucherCode(prefix || promo.code);
      const voucher = await this.storage.createVoucher({
        code,
        promoId,
        assignedTo: assignedTo || null,
        status: 'active',
        validFrom: promo.validFrom,
        validTo: promo.validTo,
      });
      results.push(voucher);
    }
    return results;
  }

  async revokeVoucher(id: string): Promise<Voucher> {
    return this.storage.updateVoucher(id, { status: 'revoked' } as any);
  }

  async deleteVoucher(id: string): Promise<void> {
    return this.storage.deleteVoucher(id);
  }

  async validateAndCalculateDiscount(
    code: string,
    subtotal: number,
    ctx: {
      channel?: string;
      tripId?: string;
      patternId?: string;
      outletId?: string;
      salesChannelCode?: string;
      departureDate?: Date | string;
    } = {}
  ): Promise<PromoValidationResult> {
    const { channel, tripId, patternId, outletId, salesChannelCode, departureDate } = ctx;
    const upperCode = code.toUpperCase();

    const voucher = await this.storage.getVoucherByCode(upperCode);
    let promo: Promotion | undefined;

    if (voucher) {
      if (voucher.status !== 'active') {
        return { valid: false, discountAmount: 0, error: 'Voucher sudah digunakan atau tidak aktif' };
      }
      if (voucher.validFrom && new Date(voucher.validFrom) > new Date()) {
        return { valid: false, discountAmount: 0, error: 'Voucher belum berlaku' };
      }
      if (voucher.validTo && new Date(voucher.validTo) < new Date()) {
        return { valid: false, discountAmount: 0, error: 'Voucher sudah kadaluarsa' };
      }
      promo = await this.storage.getPromotionById(voucher.promoId);
    } else {
      promo = await this.storage.getPromotionByCode(upperCode);
      if (promo && promo.requireVoucher) {
        return { valid: false, discountAmount: 0, error: 'Promo ini membutuhkan kode voucher' };
      }
    }

    if (!promo) {
      return { valid: false, discountAmount: 0, error: 'Kode promo/voucher tidak ditemukan' };
    }

    if (!promo.isActive) {
      return { valid: false, discountAmount: 0, error: 'Promo tidak aktif' };
    }

    if (promo.validFrom && new Date(promo.validFrom) > new Date()) {
      return { valid: false, discountAmount: 0, error: 'Promo belum berlaku' };
    }
    if (promo.validTo && new Date(promo.validTo) < new Date()) {
      return { valid: false, discountAmount: 0, error: 'Promo sudah kadaluarsa' };
    }

    if (promo.usageLimit !== null && (promo.usageCount ?? 0) >= promo.usageLimit) {
      return { valid: false, discountAmount: 0, error: 'Kuota promo sudah habis' };
    }

    const minPurchase = Number(promo.minPurchase || 0);
    if (subtotal < minPurchase) {
      return { valid: false, discountAmount: 0, error: `Minimum pembelian Rp ${minPurchase.toLocaleString('id-ID')}` };
    }

    const conditions = await this.storage.getPromoConditions(promo.id);
    const condError = this.checkConditions(conditions, ctx);
    if (condError) {
      return { valid: false, discountAmount: 0, error: condError };
    }

    const discountAmount = this.computeDiscount(promo, subtotal);

    return {
      valid: true,
      promotion: promo,
      voucher: voucher || undefined,
      discountAmount
    };
  }

  private checkConditions(
    conditions: PromoCondition[],
    ctx: { channel?: string; tripId?: string; patternId?: string; outletId?: string; salesChannelCode?: string; departureDate?: Date | string }
  ): string | null {
    const errorByType: Record<string, string> = {
      route: 'Promo tidak berlaku untuk rute ini',
      trip: 'Promo tidak berlaku untuk trip ini',
      channel: 'Promo tidak berlaku untuk channel ini',
      outlet: 'Promo tidak berlaku untuk outlet ini',
      sales_channel: 'Promo tidak berlaku untuk sales channel ini',
      day_of_week: 'Promo tidak berlaku untuk hari ini',
    };
    const ctxValueByType: Record<string, string | undefined> = {
      route: ctx.patternId,
      trip: ctx.tripId,
      channel: ctx.channel,
      outlet: ctx.outletId,
      sales_channel: ctx.salesChannelCode,
      day_of_week: ctx.departureDate ? String(new Date(ctx.departureDate).getDay()) : undefined,
    };
    for (const cond of conditions) {
      const values = (cond.values as string[]) || [];
      if (values.length === 0) continue;
      const ctxValue = ctxValueByType[cond.type];
      if (!ctxValue) return errorByType[cond.type] ?? 'Konteks promo tidak lengkap';
      if (!values.includes(ctxValue)) return errorByType[cond.type] ?? 'Konteks promo tidak cocok';
    }
    return null;
  }

  private computeDiscount(promo: Promotion, subtotal: number): number {
    let discountAmount = 0;
    if (promo.type === 'percentage') {
      discountAmount = Math.round(subtotal * Number(promo.discountValue) / 100);
      const maxDiscount = promo.maxDiscount ? Number(promo.maxDiscount) : null;
      if (maxDiscount && discountAmount > maxDiscount) discountAmount = maxDiscount;
    } else {
      discountAmount = Number(promo.discountValue);
    }
    if (discountAmount > subtotal) discountAmount = subtotal;
    return discountAmount;
  }

  /**
   * Cari promo auto-apply terbaik (requireVoucher=false, isActive, valid, kondisi cocok).
   * Returns promo dengan discount terbesar untuk subtotal yang diberikan.
   */
  async findBestAutoApplicablePromo(
    subtotal: number,
    ctx: {
      channel?: string;
      tripId?: string;
      patternId?: string;
      outletId?: string;
      salesChannelCode?: string;
      departureDate?: Date | string;
    } = {}
  ): Promise<{ promotion: Promotion; discountAmount: number } | null> {
    const all = await this.storage.getPromotions();
    const now = new Date();
    const candidates = all.filter(p =>
      p.isActive &&
      !p.requireVoucher &&
      (!p.validFrom || new Date(p.validFrom) <= now) &&
      (!p.validTo || new Date(p.validTo) >= now) &&
      (p.usageLimit === null || (p.usageCount ?? 0) < p.usageLimit) &&
      subtotal >= Number(p.minPurchase || 0)
    );

    // Bulk-fetch semua kondisi sekaligus (hindari N+1)
    const conditionsMap = await this.storage.getPromoConditionsForPromos(candidates.map(p => p.id));

    let best: { promotion: Promotion; discountAmount: number } | null = null;
    console.log('[findBestAutoApplicablePromo] candidates=', candidates.map(c => c.code), 'ctx=', JSON.stringify(ctx));
    for (const promo of candidates) {
      const conditions = conditionsMap.get(promo.id) ?? [];
      const condErr = this.checkConditions(conditions, ctx);
      if (condErr !== null) {
        console.log(`[findBestAutoApplicablePromo] ${promo.code} skip: ${condErr}; conditions=`, conditions.map(c => ({ type: c.type, values: c.values })));
        continue;
      }
      const discountAmount = this.computeDiscount(promo, subtotal);
      console.log(`[findBestAutoApplicablePromo] ${promo.code} OK discount=${discountAmount}`);
      if (discountAmount <= 0) continue;
      if (!best || discountAmount > best.discountAmount) {
        best = { promotion: promo, discountAmount };
      }
    }
    return best;
  }

  async markUsed(promoId: string, voucherId?: string, bookingId?: string): Promise<void> {
    await this.storage.incrementPromoUsage(promoId);
    if (voucherId) {
      await this.storage.updateVoucher(voucherId, {
        status: 'used',
        usedAt: new Date(),
        usedByBookingId: bookingId || null,
      } as any);
    }
  }

  private generateVoucherCode(prefix: string): string {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${random}`;
  }
}
