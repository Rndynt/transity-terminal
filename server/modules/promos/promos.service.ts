import { IStorage } from "@server/storage.interface";
import { type Promotion, type Voucher, type InsertPromotion, type InsertVoucher, type PromoCondition, type PromoConditionInput, type InsertBookingPromoApplication } from "@shared/schema";
import crypto from "crypto";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09 (Sprint 2): semua mutasi promo & voucher memanggil
 * `requirePermission(ctx, 'master.promos')`. Method read (`getAll*`,
 * `getById*`, `validateAndCalculateDiscount`, `findBestAutoApplicablePromo`,
 * `listScopedPromotions`, `persistApplications`, `markApplicationsUsed`,
 * `markUsed`) tidak di-guard karena dipanggil dari booking flow internal
 * (sudah di-guard oleh action.booking.create) dan oleh customer-app yang
 * memang boleh membaca daftar promo. Lihat `server/modules/rbac/README.md`.
 */

export interface PromoApplicationItem {
  promoId: string;
  promoCode: string;
  voucherId?: string;
  voucherCode?: string;
  source: 'manual' | 'auto';
  discountAmount: number;
}

export interface PromoValidationResult {
  valid: boolean;
  promotion?: Promotion;
  voucher?: Voucher;
  discountAmount: number;
  error?: string;
  // Stacking: bila auto-promo ikut digabung (kedua promo stackable=true)
  autoPromotion?: Promotion;
  autoDiscountAmount?: number;
  // Daftar aplikasi promo yang akan dipersist ke booking_promo_applications
  applications?: PromoApplicationItem[];
}

export interface PromoContext {
  channel?: string;
  tripId?: string;
  patternId?: string;
  outletId?: string;
  salesChannelCode?: string;
  departureDate?: Date | string;
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

  async createPromotion(data: InsertPromotion, ctx: ServiceContext): Promise<Promotion> {
    requirePermission(ctx, "master.promos");
    const existing = await this.storage.getPromotionByCode(data.code);
    if (existing) throw new Error('Kode promo sudah digunakan');
    return this.storage.createPromotion(data);
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>, ctx: ServiceContext): Promise<Promotion> {
    requirePermission(ctx, "master.promos");
    if (data.code) {
      const existing = await this.storage.getPromotionByCode(data.code);
      if (existing && existing.id !== id) throw new Error('Kode promo sudah digunakan');
    }
    return this.storage.updatePromotion(id, data);
  }

  async deletePromotion(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.promos");
    return this.storage.deletePromotion(id);
  }

  async getConditions(promoId: string): Promise<PromoCondition[]> {
    return this.storage.getPromoConditions(promoId);
  }

  async replaceConditions(promoId: string, conditions: PromoConditionInput[], ctx: ServiceContext): Promise<PromoCondition[]> {
    requirePermission(ctx, "master.promos");
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

  async generateVouchers(promoId: string, count: number, prefix: string | undefined, assignedTo: string | undefined, ctx: ServiceContext): Promise<Voucher[]> {
    requirePermission(ctx, "master.promos");
    const promo = await this.storage.getPromotionById(promoId);
    if (!promo) throw new Error('Promotion not found');

    const results: Voucher[] = [];
    const maxAttempts = count * 5;
    let attempts = 0;
    while (results.length < count && attempts < maxAttempts) {
      attempts++;
      const code = this.generateVoucherCode(prefix || promo.code);
      try {
        const voucher = await this.storage.createVoucher({
          code,
          promoId,
          assignedTo: assignedTo || null,
          status: 'active',
          validFrom: promo.validFrom,
          validTo: promo.validTo,
        });
        results.push(voucher);
      } catch (err: unknown) {
        const e = err as { code?: string; cause?: { code?: string } };
        if (e?.code === '23505' || e?.cause?.code === '23505') {
          continue;
        }
        throw err;
      }
    }

    if (results.length < count) {
      throw new Error(
        `Voucher generation collision: hanya ${results.length}/${count} unique code dapat dibuat dalam ${attempts} percobaan. Pertimbangkan prefix lebih panjang.`
      );
    }
    return results;
  }

  async revokeVoucher(id: string, ctx: ServiceContext): Promise<Voucher> {
    requirePermission(ctx, "master.promos");
    return this.storage.updateVoucher(id, { status: 'revoked' });
  }

  async deleteVoucher(id: string, ctx: ServiceContext): Promise<void> {
    requirePermission(ctx, "master.promos");
    return this.storage.deleteVoucher(id);
  }

  async validateAndCalculateDiscount(
    code: string,
    subtotal: number,
    ctx: PromoContext = {}
  ): Promise<PromoValidationResult> {
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

    const manualDiscount = this.computeDiscount(promo, subtotal);

    const applications: PromoApplicationItem[] = [{
      promoId: promo.id,
      promoCode: promo.code,
      voucherId: voucher?.id,
      voucherCode: voucher?.code,
      source: 'manual',
      discountAmount: manualDiscount,
    }];

    // Stacking: jika promo manual stackable, cari auto-applicable promo lain yg juga stackable.
    let autoPromotion: Promotion | undefined;
    let autoDiscountAmount = 0;
    if (promo.stackable) {
      const companion = await this.findBestAutoApplicablePromo(subtotal, ctx, { excludePromoId: promo.id, requireStackable: true });
      if (companion) {
        autoPromotion = companion.promotion;
        autoDiscountAmount = companion.discountAmount;
        applications.push({
          promoId: companion.promotion.id,
          promoCode: companion.promotion.code,
          source: 'auto',
          discountAmount: autoDiscountAmount,
        });
      }
    }

    let totalDiscount = manualDiscount + autoDiscountAmount;
    if (totalDiscount > subtotal && totalDiscount > 0) {
      const factor = subtotal / totalDiscount;
      for (const app of applications) {
        app.discountAmount = Math.round(app.discountAmount * factor);
      }
      totalDiscount = applications.reduce((s, a) => s + a.discountAmount, 0);
    }

    return {
      valid: true,
      promotion: promo,
      voucher: voucher || undefined,
      discountAmount: totalDiscount,
      autoPromotion,
      autoDiscountAmount: autoPromotion ? autoDiscountAmount : undefined,
      applications,
    };
  }

  private checkConditions(
    conditions: PromoCondition[],
    ctx: PromoContext
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
    ctx: PromoContext = {},
    opts: { excludePromoId?: string; requireStackable?: boolean } = {}
  ): Promise<{ promotion: Promotion; discountAmount: number } | null> {
    const all = await this.storage.getPromotions();
    const now = new Date();
    const candidates = all.filter(p =>
      p.isActive &&
      !p.requireVoucher &&
      (!opts.excludePromoId || p.id !== opts.excludePromoId) &&
      (!opts.requireStackable || p.stackable) &&
      (!p.validFrom || new Date(p.validFrom) <= now) &&
      (!p.validTo || new Date(p.validTo) >= now) &&
      (p.usageLimit === null || (p.usageCount ?? 0) < p.usageLimit) &&
      subtotal >= Number(p.minPurchase || 0)
    );

    const conditionsMap = await this.storage.getPromoConditionsForPromos(candidates.map(p => p.id));

    let best: { promotion: Promotion; discountAmount: number } | null = null;
    for (const promo of candidates) {
      const conditions = conditionsMap.get(promo.id) ?? [];
      if (this.checkConditions(conditions, ctx) !== null) continue;
      const discountAmount = this.computeDiscount(promo, subtotal);
      if (discountAmount <= 0) continue;
      if (!best || discountAmount > best.discountAmount) {
        best = { promotion: promo, discountAmount };
      }
    }
    return best;
  }

  /**
   * Public API: list promo aktif yang berlaku utk konteks (channel/outlet/trip/pattern/dst).
   * Termasuk promo yang membutuhkan voucher (requireVoucher=true) sehingga partner OTA
   * bisa menampilkan daftar promo yang bisa user redeem dgn voucher.
   * Jika `subtotal` diberikan, hitung juga estimasi diskon per promo.
   */
  async listScopedPromotions(
    ctx: PromoContext = {},
    opts: { subtotal?: number; includeRequireVoucher?: boolean } = {}
  ): Promise<Array<{ promotion: Promotion; estimatedDiscount?: number; eligible: boolean; reason?: string }>> {
    const all = await this.storage.getPromotions();
    const now = new Date();

    const baseFiltered = all.filter(p =>
      p.isActive &&
      (opts.includeRequireVoucher !== false || !p.requireVoucher) &&
      (!p.validFrom || new Date(p.validFrom) <= now) &&
      (!p.validTo || new Date(p.validTo) >= now) &&
      (p.usageLimit === null || (p.usageCount ?? 0) < p.usageLimit)
    );

    const conditionsMap = await this.storage.getPromoConditionsForPromos(baseFiltered.map(p => p.id));
    const subtotal = opts.subtotal;

    return baseFiltered.map(promo => {
      const conditions = conditionsMap.get(promo.id) ?? [];
      const condError = this.checkConditions(conditions, ctx);
      if (condError) return { promotion: promo, eligible: false, reason: condError };
      if (subtotal !== undefined && subtotal < Number(promo.minPurchase || 0)) {
        return { promotion: promo, eligible: false, reason: `Minimum pembelian Rp ${Number(promo.minPurchase).toLocaleString('id-ID')}` };
      }
      const estimatedDiscount = subtotal !== undefined ? this.computeDiscount(promo, subtotal) : undefined;
      return { promotion: promo, eligible: true, estimatedDiscount };
    });
  }

  /**
   * Persist semua aplikasi promo ke booking_promo_applications. Dipanggil setelah
   * booking di-insert. Tidak menambah promo usage — itu dilakukan saat booking confirm/paid.
   */
  async persistApplications(bookingId: string, applications: PromoApplicationItem[]): Promise<void> {
    if (!applications || applications.length === 0) return;
    const rows: InsertBookingPromoApplication[] = applications.map(a => ({
      bookingId,
      promoId: a.promoId,
      promoCode: a.promoCode,
      voucherId: a.voucherId ?? null,
      voucherCode: a.voucherCode ?? null,
      source: a.source,
      discountAmount: a.discountAmount.toString(),
    }));
    await this.storage.createBookingPromoApplications(rows);
  }

  /**
   * Increment usage utk semua promo yang diaplikasikan ke booking, dan tandai voucher
   * sebagai used. Dipanggil saat booking transit ke status confirmed/paid.
   */
  async markApplicationsUsed(bookingId: string): Promise<void> {
    const apps = await this.storage.getBookingPromoApplications(bookingId);
    for (const app of apps) {
      await this.storage.incrementPromoUsage(app.promoId);
      if (app.voucherId) {
        await this.storage.updateVoucher(app.voucherId, {
          status: 'used',
          usedAt: new Date(),
          usedByBookingId: bookingId,
        });
      }
    }
  }

  async markUsed(promoId: string, voucherId?: string, bookingId?: string): Promise<void> {
    await this.storage.incrementPromoUsage(promoId);
    if (voucherId) {
      await this.storage.updateVoucher(voucherId, {
        status: 'used',
        usedAt: new Date(),
        usedByBookingId: bookingId || null,
      });
    }
  }

  private generateVoucherCode(prefix: string): string {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${random}`;
  }
}
