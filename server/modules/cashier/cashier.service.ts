import { db } from "../../db";
import { cashierSessions, cashierSettlements } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class CashierService {
  async getActiveSession(outletId: string) {
    const [session] = await db.select().from(cashierSessions)
      .where(and(eq(cashierSessions.outletId, outletId), eq(cashierSessions.status, 'open')))
      .limit(1);
    return session || null;
  }

  async openSession(data: { outletId: string; staffId: string; staffName: string; openingBalance: number; notes?: string }) {
    const [existing] = await db.select().from(cashierSessions)
      .where(and(eq(cashierSessions.outletId, data.outletId), eq(cashierSessions.status, 'open')))
      .limit(1);

    if (existing) {
      throw new Error('Masih ada sesi kasir aktif');
    }

    const [session] = await db.insert(cashierSessions).values({
      outletId: data.outletId,
      staffId: data.staffId,
      staffName: data.staffName,
      openingBalance: String(data.openingBalance || 0),
      notes: data.notes,
    }).returning();

    return session;
  }

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

  async getActiveSummary(outletId: string) {
    const session = await this.getActiveSession(outletId);
    if (!session) return { session: null, summary: [], transactions: [] };

    const summaryResult = await db.execute(sql`
      SELECT p.method, COUNT(*)::int AS count, COALESCE(SUM(p.amount::numeric), 0) AS total
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE ${this.buildOutletTimeFilter(outletId, session.openedAt, null)}
      GROUP BY p.method
      ORDER BY p.method
    `);
    const summary = Array.isArray(summaryResult) ? summaryResult : (summaryResult as any).rows || [];

    const txResult = await db.execute(sql`
      SELECT p.id, p.amount, p.method, p.status, p.paid_at AS created_at, b.booking_code
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE ${this.buildOutletTimeFilter(outletId, session.openedAt, null)}
      ORDER BY p.paid_at DESC
    `);
    const transactions = Array.isArray(txResult) ? txResult : (txResult as any).rows || [];

    return { session, summary, transactions };
  }

  async closeSession(sessionId: string, settlements: Array<{ paymentMethod: string; actualAmount: number; notes?: string }>, notes?: string) {
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
    const rows = Array.isArray(systemTotals) ? systemTotals : (systemTotals as any).rows || [];
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

  async approveSession(id: string, approvedBy: string) {
    await db.update(cashierSessions)
      .set({ status: 'approved', approvedBy, approvedAt: new Date() })
      .where(eq(cashierSessions.id, id));

    return { success: true };
  }

  async getHistory(outletId?: string) {
    const rows = await db.select().from(cashierSessions)
      .where(outletId ? eq(cashierSessions.outletId, outletId) : undefined)
      .orderBy(desc(cashierSessions.openedAt))
      .limit(50);
    return rows;
  }

  async getDetail(id: string) {
    const [session] = await db.select().from(cashierSessions).where(eq(cashierSessions.id, id));
    const settlements = await db.select().from(cashierSettlements).where(eq(cashierSettlements.sessionId, id));

    let transactions: any[] = [];
    if (session) {
      const txResult = await db.execute(sql`
        SELECT p.id, p.amount, p.method, p.status, p.paid_at AS created_at, b.booking_code
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        WHERE ${this.buildOutletTimeFilter(session.outletId, session.openedAt, session.closedAt)}
        ORDER BY p.paid_at DESC
      `);
      transactions = Array.isArray(txResult) ? txResult : (txResult as any).rows || [];
    }

    return { session, settlements, transactions };
  }
}
