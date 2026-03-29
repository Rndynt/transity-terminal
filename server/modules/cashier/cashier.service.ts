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

  async closeSession(sessionId: string, settlements: Array<{ paymentMethod: string; systemAmount: number; actualAmount: number; notes?: string }>, notes?: string) {
    await db.update(cashierSessions)
      .set({ status: 'closing', closedAt: new Date(), notes })
      .where(eq(cashierSessions.id, sessionId));

    if (settlements?.length) {
      for (const s of settlements) {
        await db.insert(cashierSettlements).values({
          sessionId,
          paymentMethod: s.paymentMethod,
          systemAmount: String(s.systemAmount || 0),
          actualAmount: String(s.actualAmount || 0),
          difference: String((s.actualAmount || 0) - (s.systemAmount || 0)),
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
        LEFT JOIN bookings b ON b.id = p.booking_id
        WHERE p.status = 'success'
          AND p.paid_at >= ${session.openedAt}
          ${session.closedAt ? sql`AND p.paid_at <= ${session.closedAt}` : sql``}
      `);
      transactions = Array.isArray(txResult) ? txResult : (txResult as any).rows || [];
    }

    return { session, settlements, transactions };
  }
}
