import { db } from "@server/db";
import { cashierSessions, cashierSettlements } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09: setiap method butuh `ctx: ServiceContext` dan akan menolak
 * dengan PermissionDeniedError kalau ctx tidak punya `page.cashier`.
 * Pemanggilan dari modul internal harus pakai `SYSTEM_CONTEXT`.
 */

/**
 * Sesi kasir sekarang per (outletId, staffId). Multiple kasir bisa buka sesi
 * paralel di outlet yang sama — masing-masing punya sesi sendiri.
 *
 * CATATAN AKURASI REKONSILIASI (Sprint 2 follow-up):
 *   payments belum punya kolom `cashier_session_id`. Sementara ini,
 *   summary/close masih menarik payments dari outlet di window waktu sesi —
 *   artinya kalau 2 kasir buka sesi overlap di outlet sama, summary akan
 *   menampilkan total outlet, bukan total per-kasir. Untuk attribusi
 *   per-kasir 100% akurat butuh menambahkan `cashier_session_id` ke payments
 *   dan stamping saat checkout (lihat ROADMAP S2-XX).
 */
export class CashierService {
  /**
   * Ambil sesi 'open' untuk (outletId, staffId). staffId WAJIB — kalau caller
   * sengaja mau lihat semua sesi di outlet, panggil `getActiveSessionsByOutlet`.
   */
  async getActiveSession(outletId: string, staffId: string, ctx: ServiceContext) {
    requirePermission(ctx, "page.cashier");
    const [session] = await db.select().from(cashierSessions)
      .where(and(
        eq(cashierSessions.outletId, outletId),
        eq(cashierSessions.staffId, staffId),
        eq(cashierSessions.status, 'open'),
      ))
      .limit(1);
    return session || null;
  }

  /** Untuk supervisor view: semua sesi 'open' di sebuah outlet. */
  async getActiveSessionsByOutlet(outletId: string, ctx: ServiceContext) {
    requirePermission(ctx, "page.cashier");
    return db.select().from(cashierSessions)
      .where(and(eq(cashierSessions.outletId, outletId), eq(cashierSessions.status, 'open')))
      .orderBy(desc(cashierSessions.openedAt));
  }

  async openSession(
    data: { outletId: string; staffId: string; staffName: string; openingBalance: number; notes?: string },
    ctx: ServiceContext,
  ) {
    requirePermission(ctx, "page.cashier");
    if (!data.staffId) throw new Error('staffId wajib untuk membuka sesi kasir');

    // Guard application-level (UNIQUE INDEX partial di-DB sebagai second line of defense).
    const [existing] = await db.select().from(cashierSessions)
      .where(and(
        eq(cashierSessions.outletId, data.outletId),
        eq(cashierSessions.staffId, data.staffId),
        eq(cashierSessions.status, 'open'),
      ))
      .limit(1);

    if (existing) {
      throw new Error('Anda masih punya sesi kasir aktif di outlet ini. Tutup dulu sebelum membuka sesi baru.');
    }

    try {
      const [session] = await db.insert(cashierSessions).values({
        outletId: data.outletId,
        staffId: data.staffId,
        staffName: data.staffName,
        openingBalance: String(data.openingBalance || 0),
        notes: data.notes,
      }).returning();
      return session;
    } catch (err: unknown) {
      // 23505 = unique_violation. Race antara dua request dari staff yang sama.
      const e = err as { code?: string; cause?: { code?: string } };
      if (e?.code === '23505' || e?.cause?.code === '23505') {
        throw new Error('Sesi kasir Anda sudah dibuka oleh request paralel. Refresh halaman.');
      }
      throw err;
    }
  }

  /**
   * Build SQL filter untuk payments di outlet pada window waktu tertentu.
   * Belum bisa filter per-staff sampai payments punya kolom cashier_session_id
   * (Sprint 2). Sementara: outlet-level di window sesi.
   */
  private buildOutletTimeFilter(outletId: string, openedAt: Date, closedAt: Date | null) {
    return closedAt
      ? sql`
          b.outlet_id = ${outletId}
          AND p.status = 'success'
          AND p.paid_at >= ${openedAt}
          AND p.paid_at <= ${closedAt}
        `
      : sql`
          b.outlet_id = ${outletId}
          AND p.status = 'success'
          AND p.paid_at >= ${openedAt}
        `;
  }

  async getActiveSummary(outletId: string, staffId: string, ctx: ServiceContext) {
    requirePermission(ctx, "page.cashier");
    const session = await this.getActiveSession(outletId, staffId, ctx);
    if (!session) return { session: null, summary: [], transactions: [] };

    const summaryResult = await db.execute(sql`
      SELECT p.method, COUNT(*)::int AS count, COALESCE(SUM(p.amount::numeric), 0) AS total
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE ${this.buildOutletTimeFilter(outletId, session.openedAt, null)}
      GROUP BY p.method
      ORDER BY p.method
    `);
    const summary = Array.isArray(summaryResult) ? summaryResult : (summaryResult as { rows?: unknown[] }).rows || [];

    const txResult = await db.execute(sql`
      SELECT p.id, p.amount, p.method, p.status, p.paid_at AS created_at, b.booking_code
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE ${this.buildOutletTimeFilter(outletId, session.openedAt, null)}
      ORDER BY p.paid_at DESC
    `);
    const transactions = Array.isArray(txResult) ? txResult : (txResult as { rows?: unknown[] }).rows || [];

    return { session, summary, transactions };
  }

  async closeSession(
    sessionId: string,
    settlements: Array<{ paymentMethod: string; actualAmount: number; notes?: string }>,
    notes: string | undefined,
    ctx: ServiceContext,
  ) {
    requirePermission(ctx, "page.cashier");
    const [session] = await db.select().from(cashierSessions).where(eq(cashierSessions.id, sessionId));
    if (!session) throw new Error('Sesi tidak ditemukan');
    if (session.status !== 'open') throw new Error('Sesi sudah ditutup');

    const closedAt = new Date();

    const systemTotals = await db.execute(sql`
      SELECT p.method, COALESCE(SUM(p.amount::numeric), 0) AS total
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE ${this.buildOutletTimeFilter(session.outletId, session.openedAt, closedAt)}
      GROUP BY p.method
    `);
    const systemByMethod: Record<string, number> = {};
    const rows = (Array.isArray(systemTotals) ? systemTotals : (systemTotals as { rows?: unknown[] }).rows || []) as Array<{ method: string; total: string }>;
    for (const r of rows) {
      systemByMethod[r.method] = parseFloat(r.total) || 0;
    }

    await db.update(cashierSessions)
      .set({ status: 'closing', closedAt, notes })
      .where(eq(cashierSessions.id, sessionId));

    if (settlements?.length) {
      for (const s of settlements) {
        const systemAmount = systemByMethod[s.paymentMethod] || 0;
        const actualAmount = s.actualAmount || 0;
        await db.insert(cashierSettlements).values({
          sessionId,
          paymentMethod: s.paymentMethod,
          systemAmount: String(systemAmount),
          actualAmount: String(actualAmount),
          difference: String(actualAmount - systemAmount),
          notes: s.notes,
        });
      }
    }

    return { success: true };
  }

  async approveSession(id: string, approvedBy: string, ctx: ServiceContext) {
    requirePermission(ctx, "page.cashier");
    await db.update(cashierSessions)
      .set({ status: 'approved', approvedBy, approvedAt: new Date() })
      .where(eq(cashierSessions.id, id));

    return { success: true };
  }

  async getHistory(outletId: string | undefined, staffId: string | undefined, ctx: ServiceContext) {
    requirePermission(ctx, "page.cashier");
    const conds = [];
    if (outletId) conds.push(eq(cashierSessions.outletId, outletId));
    if (staffId) conds.push(eq(cashierSessions.staffId, staffId));
    const rows = await db.select().from(cashierSessions)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(cashierSessions.openedAt))
      .limit(50);
    return rows;
  }

  async getDetail(id: string, ctx: ServiceContext) {
    requirePermission(ctx, "page.cashier");
    const [session] = await db.select().from(cashierSessions).where(eq(cashierSessions.id, id));
    const settlements = await db.select().from(cashierSettlements).where(eq(cashierSettlements.sessionId, id));

    let transactions: unknown[] = [];
    if (session) {
      const txResult = await db.execute(sql`
        SELECT p.id, p.amount, p.method, p.status, p.paid_at AS created_at, b.booking_code
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        WHERE ${this.buildOutletTimeFilter(session.outletId, session.openedAt, session.closedAt)}
        ORDER BY p.paid_at DESC
      `);
      transactions = Array.isArray(txResult) ? txResult : (txResult as { rows?: unknown[] }).rows || [];
    }

    return { session, settlements, transactions };
  }
}
